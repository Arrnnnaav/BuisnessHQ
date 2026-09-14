import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLog } from "../core/runtime/index.mjs";
import { PluginRegistry, PublishingPipeline, TenantManager, ReviewQueue, generateSigningKeys, sanitizeHeartbeat, verifyPackage, TelemetryContractViolation, PLANS, pluginAnalytics, operatorRecommendations, validateRepositoryUrl } from "../control-plane/index.mjs";
import { MIN_OPERATOR_TOKEN_LENGTH, validateOperatorToken } from "../operator/token-policy.mjs";

const dir = await mkdtemp(join(tmpdir(), "businessos-control-plane-"));
const audit = new AuditLog();
const keys = generateSigningKeys();

// ---- Operator authentication policy --------------------------------------------------
assert.equal(MIN_OPERATOR_TOKEN_LENGTH, 32);
assert.equal(validateOperatorToken("x".repeat(MIN_OPERATOR_TOKEN_LENGTH - 1)), false);
assert.equal(validateOperatorToken("x".repeat(MIN_OPERATOR_TOKEN_LENGTH)), true);
assert.equal(validateOperatorToken(null), false);
assert.equal(validateRepositoryUrl("https://github.com/example/plugin"), "https://github.com/example/plugin.git");
assert.throws(() => validateRepositoryUrl("https://example.com/plugin"), /Only HTTPS GitHub/);
const reviews = new ReviewQueue();
const review = await reviews.submit({ pluginId: "demo", version: "1.0.0", needsReview: ["tests"], report: "Passed with findings" }, { requestedBy: "operator-1" });
assert.equal(reviews.list({ status: "pending" }).length, 1);
assert.equal((await reviews.decide(review.id, { decision: "approved", approvedBy: "reviewer-1" })).status, "approved");

// ---- The privacy boundary (ruling R6) ------------------------------------------------
// This is the promise that makes centralised management compatible with local-first, so it
// is tested first and hardest.
{
  const leaky = {
    tenantId: "t-1", companyName: "ABizCreator", coreVersion: "0.9.0", healthState: "healthy",
    // Everything below must not survive.
    companyBrain: [{ fact: "margin is 32%" }],
    customers: [{ name: "A Customer", phone: "+91..." }],
    credentials: { wordpress: "app-password" },
    auditContents: ["seo.experiment-active"],
    conversation: [{ role: "user", content: "what should I charge" }],
    plugins: [
      { id: "seo", version: "1.0.0", state: "enabled", health: "healthy", leadRecords: [{ email: "someone@example.com" }] },
    ],
  };

  assert.throws(() => sanitizeHeartbeat(leaky), TelemetryContractViolation,
    "a payload naming business content is rejected outright");

  const beat = sanitizeHeartbeat({
    tenantId: "t-1", companyName: "ABizCreator", coreVersion: "0.9.0", healthState: "healthy",
    plugins: [{ id: "seo", version: "1.0.0", state: "enabled", health: "healthy", leadRecords: [{ email: "someone@example.com" }] }],
    somethingNew: "invented later",
  });

  // The allowlist drops what it was not told about, including a field nobody anticipated.
  assert.deepEqual(Object.keys(beat).sort(), ["companyName", "coreVersion", "healthState", "plugins", "tenantId"]);
  assert.equal("somethingNew" in beat, false);
  assert.deepEqual(Object.keys(beat.plugins[0]).sort(), ["health", "id", "state", "version"]);
  assert.equal(JSON.stringify(beat).includes("someone@example.com"), false, "no plugin data may cross the boundary");
  assert.equal(JSON.stringify(beat).includes("margin"), false);

  assert.throws(() => sanitizeHeartbeat({}), /needs a tenantId/);
  // An unrecognised health value degrades to unknown rather than being stored as given.
  assert.equal(sanitizeHeartbeat({ tenantId: "t-1", healthState: "excellent" }).healthState, "unknown");
}

// ---- Registry, channels and signing ---------------------------------------------------
const registry = new PluginRegistry({ stateFile: join(dir, "registry.json"), signingKeys: keys });
await registry.load();

await registry.registerPlugin({ id: "seo", name: "SEO Growth", category: "growth", description: "Search visibility." });
await registry.registerPlugin({ id: "crm", name: "CRM", category: "business" });
await registry.registerPlugin({ id: "campaigns", name: "Campaign Intelligence", category: "growth", requiredPlan: "pro" });
await registry.registerPlugin({ id: "acme-custom", name: "Acme Custom", visibility: "private", tenants: ["t-acme"] });

const files = { "index.mjs": "export const run = () => 'seo';", "plugin.json": '{"id":"seo"}' };
const v100 = await registry.publishVersion({ pluginId: "seo", version: "1.0.0", files, channel: "stable" });
assert.ok(v100.signature, "a published version is signed");
assert.ok(v100.checksum);

// A version is immutable: fixing a bad release means publishing a new one.
await assert.rejects(() => registry.publishVersion({ pluginId: "seo", version: "1.0.0", files, channel: "stable" }), /already published/);
await assert.rejects(() => registry.publishVersion({ pluginId: "seo", version: "1.0", files }), /look like 1\.2\.3/);
await assert.rejects(() => registry.publishVersion({ pluginId: "nope", version: "1.0.0", files }), /Unknown plugin/);

// ---- Signature verification is real ---------------------------------------------------
{
  const bundle = registry.download("seo", { tenantId: "t-1", channel: "stable" });
  assert.equal(registry.verify(bundle).valid, true);

  // A tampered package fails on checksum before any signature check.
  const tampered = { ...bundle, files: { ...bundle.files, "index.mjs": "export const run = () => 'evil';" } };
  const tamperResult = registry.verify(tampered);
  assert.equal(tamperResult.valid, false);
  assert.match(tamperResult.reason, /altered/);

  // A signature from a different publisher is refused.
  const other = generateSigningKeys();
  assert.equal(verifyPackage({ ...bundle, publicKey: other.publicKey }).valid, false);

  // An unsigned package is refused rather than trusted.
  assert.equal(verifyPackage({ ...bundle, signature: null }).valid, false);

  // A signature cannot be lifted from one version onto another.
  await registry.publishVersion({ pluginId: "crm", version: "1.0.0", files: { "a.mjs": "1" }, channel: "stable" });
  const crmBundle = registry.download("crm", { tenantId: "t-1" });
  assert.equal(verifyPackage({ ...crmBundle, signature: bundle.signature, publicKey: keys.publicKey }).valid, false);
}

// ---- Release channels -----------------------------------------------------------------
await registry.publishVersion({ pluginId: "seo", version: "1.1.0", files, channel: "beta" });

// A stable client does not see a beta release; a beta client sees both and takes the newer.
assert.equal(registry.resolveVersion("seo", { channel: "stable" }).version, "1.0.0");
assert.equal(registry.resolveVersion("seo", { channel: "beta" }).version, "1.1.0");

// Promotion ships the bytes that were tested, rather than republishing.
await registry.promote("seo", "1.1.0", "stable");
assert.equal(registry.resolveVersion("seo", { channel: "stable" }).version, "1.1.0");

// ---- Core compatibility ----------------------------------------------------------------
await registry.publishVersion({ pluginId: "seo", version: "2.0.0", files, channel: "stable", minimumCoreVersion: "1.5.0" });
assert.equal(registry.resolveVersion("seo", { channel: "stable", coreVersion: "0.9.0" }).version, "1.1.0",
  "an installation too old for a release is offered the newest one it can run");
assert.equal(registry.resolveVersion("seo", { channel: "stable", coreVersion: "1.5.0" }).version, "2.0.0");
assert.throws(() => registry.download("seo", { version: "2.0.0", coreVersion: "0.9.0" }), /needs BusinessOS 1\.5\.0/);

// ---- Kill switch: known platform states only -------------------------------------------
await assert.rejects(() => registry.blockVersion("seo", "2.0.0"), /requires a reason/);
await registry.blockVersion("seo", "2.0.0", "Corrupts meta descriptions");
assert.equal(registry.resolveVersion("seo", { channel: "stable", coreVersion: "1.5.0" }).version, "1.1.0",
  "a blocked version is no longer offered");
assert.throws(() => registry.download("seo", { version: "2.0.0", coreVersion: "1.5.0" }), /withdrawn: Corrupts meta descriptions/);
await registry.unblockVersion("seo", "2.0.0");
assert.equal(registry.resolveVersion("seo", { channel: "stable", coreVersion: "1.5.0" }).version, "2.0.0");
await registry.blockVersion("seo", "2.0.0", "Corrupts meta descriptions");

// ---- Staged rollout ---------------------------------------------------------------------
await registry.publishVersion({ pluginId: "crm", version: "1.1.0", files: { "a.mjs": "2" }, channel: "stable" });
await registry.startRollout({ pluginId: "crm", version: "1.1.0", stages: [{ tenants: ["t-canary"] }, { percent: 50 }, { percent: 100 }] });

// Stage 1 reaches the canary and nobody else.
assert.equal(registry.resolveVersion("crm", { tenantId: "t-canary" }).version, "1.1.0");
assert.equal(registry.resolveVersion("crm", { tenantId: "t-other" }).version, "1.0.0");

// Bucketing is deterministic, so a company does not flip in and out between checks.
await registry.advanceRollout("crm", "1.1.0");
const sample = Array.from({ length: 200 }, (_, index) => registry.resolveVersion("crm", { tenantId: `t-${index}` }).version);
const upgraded = sample.filter((version) => version === "1.1.0").length;
assert.ok(upgraded > 60 && upgraded < 140, `about half of 200 tenants should be upgraded, saw ${upgraded}`);
assert.equal(registry.resolveVersion("crm", { tenantId: "t-7" }).version, registry.resolveVersion("crm", { tenantId: "t-7" }).version);

// Pausing halts the rollout without withdrawing what already shipped.
await registry.pauseRollout("crm", "1.1.0");
assert.equal(registry.resolveVersion("crm", { tenantId: "t-canary" }).version, "1.0.0");
await registry.pauseRollout("crm", "1.1.0", false);
await registry.advanceRollout("crm", "1.1.0");
assert.equal(registry.resolveVersion("crm", { tenantId: "t-anyone" }).version, "1.1.0");

// ---- Plans, entitlements and private plugins ---------------------------------------------
const tenants = new TenantManager({ stateFile: join(dir, "tenants.json") });
await tenants.load();
await tenants.register({ tenantId: "t-1", companyName: "ABizCreator", plan: "free", channel: "beta" });
await tenants.register({ tenantId: "t-acme", companyName: "Acme", plan: "pro" });

await registry.publishVersion({ pluginId: "campaigns", version: "1.0.0", files: { "a.mjs": "4" }, channel: "stable" });

// A pro-only app is listed for a free company, so they can see it exists — but not installable.
const freeCatalog = registry.catalog({ tenantId: "t-1", plan: "free", channel: "stable" });
const campaigns = freeCatalog.find((entry) => entry.id === "campaigns");
assert.ok(campaigns, "a plan-gated app is still listed");
assert.equal(campaigns.entitled, false);
assert.throws(() => registry.download("campaigns", { tenantId: "t-1", plan: "free" }), /needs the pro plan/);

// A grant lets one company have one app its plan would not include.
await tenants.grant("t-1", "campaigns");
const granted = tenants.get("t-1");
assert.equal(registry.catalog({ tenantId: "t-1", plan: "free", entitlements: granted.entitlements }).find((entry) => entry.id === "campaigns").entitled, true);

// A private plugin is invisible to everyone but its tenant, and download denies its
// existence rather than confirming it.
await registry.publishVersion({ pluginId: "acme-custom", version: "1.0.0", files: { "a.mjs": "3" }, channel: "stable" });
assert.equal(registry.catalog({ tenantId: "t-1", plan: "free" }).some((entry) => entry.id === "acme-custom"), false);
assert.equal(registry.catalog({ tenantId: "t-acme", plan: "pro" }).some((entry) => entry.id === "acme-custom"), true);
assert.throws(() => registry.download("acme-custom", { tenantId: "t-1", plan: "free" }), /Unknown app/);

// Slot limits are reported, not enforced retroactively.
await tenants.heartbeat({ tenantId: "t-1", coreVersion: "0.9.0", healthState: "healthy", plugins: [
  { id: "seo", version: "1.1.0", state: "enabled" }, { id: "crm", version: "1.0.0", state: "enabled" }, { id: "catalog", version: "1.0.0", state: "enabled" },
] });
const slots = tenants.slots("t-1");
assert.equal(slots.limit, PLANS.free.slots);
assert.equal(slots.used, 3);
assert.equal(slots.overLimit, true, "over the limit is reported");
assert.equal(tenants.get("t-1").plugins.length, 3, "nothing is removed because of a plan limit");

// ---- Health and the operator overview ------------------------------------------------------
assert.equal(tenants.health("t-1").state, "healthy");
assert.equal(tenants.health("t-acme").state, "unknown", "an installation that never checked in is unknown, not healthy");

// Silence is not health.
const stale = new TenantManager({ clock: () => Date.parse("2026-09-09T00:00:00Z") });
await stale.register({ tenantId: "t-old", companyName: "Quiet Co" });
await stale.heartbeat({ tenantId: "t-old", healthState: "healthy" });
stale.clock = () => Date.parse("2026-09-12T00:00:00Z");
assert.equal(stale.health("t-old").state, "unknown");
assert.match(stale.health("t-old").reason, /Last seen/);

const overview = tenants.overview();
assert.equal(overview.companies, 2);
assert.equal(overview.healthy, 1);
assert.equal(overview.pluginInstalls, 3);

// Operator assignments and metadata-only recommendations never require customer content.
await tenants.addUser("t-1", "user-1", "Operator test user");
await tenants.assignPlugin("t-1", "seo", "user-1");
assert.equal(tenants.get("t-1").users[0].userId, "user-1");
assert.equal(tenants.get("t-1").assignments[0].pluginId, "seo");
assert.equal(tenants.get("t-1").plugins.length, 3, "assignment does not duplicate an installed plugin");
await tenants.heartbeat({ tenantId: "t-1", healthState: "healthy", plugins: [{ id: "seo", version: "1.1.0", state: "enabled" }] });
assert.equal(tenants.get("t-1").assignments.length, 1, "heartbeat cannot erase operator assignments");
const analytics = pluginAnalytics(registry.list(), tenants.list());
assert.equal(analytics.find((item) => item.pluginId === "seo").tenantCount, 1);
assert.ok(Array.isArray(operatorRecommendations(registry.list(), tenants.list())));
await tenants.unassignPlugin("t-1", "seo", "user-1");
assert.equal(tenants.get("t-1").assignments.length, 0);
await tenants.removeUser("t-1", "user-1");
assert.equal(tenants.get("t-1").users.length, 0);

// ---- Publishing pipeline ----------------------------------------------------------------
const repo = join(dir, "repo");
await mkdir(repo, { recursive: true });
await writeFile(join(repo, "plugin.json"), JSON.stringify({
  schema: "businessos-plugin/v1", id: "reviews", name: "Review Manager", version: "1.0.0",
  description: "Reply to reviews.", category: "growth",
  runtime: { type: "node" },
  capabilities: [{ id: "reviews.reply", description: "Draft replies" }],
  // The richer object shape the bundled plugins use; the validator reads either.
  permissions: { required: ["database.read", "database.write"] },
}, null, 2));
await writeFile(join(repo, "index.mjs"), "export const run = () => 'reviews';\n");

const pipeline = new PublishingPipeline({ registry, audit });
const clean = await pipeline.inspect(repo);
assert.equal(clean.ok, true, clean.report);
// It ships no tests, so it is flagged for review rather than shown as fully passing.
assert.deepEqual(clean.needsReview, ["tests"], "untested code is put in front of a human");
assert.equal(clean.stages.find((item) => item.stage === "manifest").passed, true);

const released = await pipeline.publish(clean, { channel: "beta", approvedBy: "operator@businessos" });
assert.equal(released.version, "1.0.0");
assert.equal(released.channel, "beta");
assert.ok(released.signature, "the pipeline publishes a signed package");
assert.ok(audit.list({ action: "registry.published" }).length > 0);

// A plugin whose own tests pass needs no manual review at all.
const tested = new PublishingPipeline({ registry, audit, sandbox: { runTests: async () => ({ passed: true, output: "3 passing" }) } });
const testedResult = await tested.inspect(repo);
assert.deepEqual(testedResult.needsReview, []);
assert.equal(testedResult.report, "All checks passed.");

// A repository with no manifest cannot be published.
const bare = join(dir, "bare");
await mkdir(bare, { recursive: true });
await writeFile(join(bare, "README.md"), "# just a readme\n");
const bareResult = await pipeline.inspect(bare);
assert.equal(bareResult.ok, false);

// High-risk permissions and suspicious code are flagged for review and block an
// unattended publish — but a named approver can still ship it.
const risky = join(dir, "risky");
await mkdir(risky, { recursive: true });
await writeFile(join(risky, "plugin.json"), JSON.stringify({
  schema: "businessos-plugin/v1", id: "risky", name: "Risky", version: "1.0.0",
  description: "Does a lot.", category: "growth",
  runtime: { type: "node" },
  capabilities: [{ id: "risky.do", description: "Do" }],
  permissions: ["network", "system.shell", "secrets.read"],
}, null, 2));
await writeFile(join(risky, "index.mjs"), "import { execSync } from 'node:child_process';\nexport const run = () => execSync('ls');\n");

const riskyResult = await pipeline.inspect(risky);
assert.equal(riskyResult.ok, true, "flagged, not failed — a human decides");
assert.ok(riskyResult.needsReview.includes("permissions"));
assert.ok(riskyResult.needsReview.includes("source-scan"));
const permissionStage = riskyResult.stages.find((item) => item.stage === "permissions");
assert.deepEqual(permissionStage.highRisk.sort(), ["network", "secrets.read", "system.shell"]);
assert.ok(riskyResult.stages.find((item) => item.stage === "source-scan").findings.some((finding) => /operating system/.test(finding.reason)));

await assert.rejects(() => pipeline.publish(riskyResult, { channel: "development" }), /needs review before publishing/);
const approved = await pipeline.publish(riskyResult, { channel: "development", approvedBy: "operator@businessos" });
assert.equal(approved.pluginId, "risky");
assert.equal(audit.list({ action: "registry.published" }).at(-1).approvedBy, "operator@businessos");

// A plugin whose own tests fail is not publishable at all.
const failing = new PublishingPipeline({ registry, audit, sandbox: { runTests: async () => ({ passed: false, output: "2 failing" }) } });
const failed = await failing.inspect(repo);
assert.equal(failed.ok, false);
assert.match(failed.report, /tests failed/);
await assert.rejects(() => failing.publish(failed, { channel: "beta" }), /tests failed/);

// ---- State survives a restart --------------------------------------------------------------
const reloaded = new PluginRegistry({ stateFile: join(dir, "registry.json"), signingKeys: keys });
await reloaded.load();
assert.equal(reloaded.list().length, registry.list().length);
assert.equal(reloaded.resolveVersion("seo", { channel: "stable", coreVersion: "1.5.0" }).version, "1.1.0",
  "a blocked version stays blocked across a restart");
assert.equal(reloaded.verify(reloaded.download("seo", { tenantId: "t-1" })).valid, true);

await rm(dir, { recursive: true, force: true });
console.log(`control plane self-test passed (${registry.list().length} plugins, ${registry.listVersions().length} versions)`);
