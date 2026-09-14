import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditLog } from "../core/runtime/index.mjs";
import { PluginRegistry, PublishingPipeline, TenantManager, ReviewQueue, FIRST_PARTY_PACKAGES, generateSigningKeys, pluginAnalytics, operatorRecommendations, importRepository } from "../control-plane/index.mjs";
import { FirstPartyPackageRegistry } from "../core/packages/package-registry.mjs";
import { MIN_OPERATOR_TOKEN_LENGTH, validateOperatorToken } from "./token-policy.mjs";

// BusinessOS Operator — our console, not a customer's (ruling R6).
//
// It runs as a **separate process on a separate port** from the customer product rather
// than as a route inside it. A misconfigured route on the customer server would expose
// every tenant's installation to a business owner; a separate process cannot be reached
// that way at all.
//
// It is not exposed publicly by default: it binds to loopback unless OPERATOR_HOST says
// otherwise, and it refuses to start without a token.

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataRoot = resolve(process.env.OPERATOR_DATA_ROOT || resolve(appRoot, "data", "control-plane"));
const importRoot = resolve(dataRoot, "imports");

const token = process.env.OPERATOR_TOKEN;
if (!validateOperatorToken(token)) {
  console.error([
    `The operator console needs OPERATOR_TOKEN set to at least ${MIN_OPERATOR_TOKEN_LENGTH} characters.`,
    "It manages every customer installation, so it does not start without one.",
    `Suggested: OPERATOR_TOKEN=${randomBytes(24).toString("base64url")}`,
  ].join("\n"));
  process.exit(1);
}

// Signing keys live with the control plane. Generated once and reused, because clients
// that already trust a public key must keep trusting it across restarts.
const keyFile = resolve(dataRoot, "signing-keys.json");
let signingKeys;
try {
  signingKeys = JSON.parse(await readFile(keyFile, "utf8"));
} catch {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(dataRoot, { recursive: true });
  signingKeys = generateSigningKeys();
  await writeFile(keyFile, JSON.stringify(signingKeys, null, 2), { mode: 0o600 });
  console.log("Generated new package signing keys.");
}

const audit = new AuditLog({ stateFile: resolve(dataRoot, "operator-audit.jsonl") });
const registry = new PluginRegistry({ stateFile: resolve(dataRoot, "registry.json"), signingKeys });
const tenants = new TenantManager({ stateFile: resolve(dataRoot, "tenants.json") });
const reviews = new ReviewQueue({ stateFile: resolve(dataRoot, "reviews.json") });
const packages = new FirstPartyPackageRegistry({ stateFile: resolve(dataRoot, "packages.json") });
await packages.load();
for (const manifest of FIRST_PARTY_PACKAGES) if (!packages.list({ includeDisabled: true }).some((item) => item.type === manifest.type && item.id === manifest.id && item.version === manifest.version)) packages.publish(manifest);
await packages.save();
const pipeline = new PublishingPipeline({ registry, audit });
await Promise.all([registry.load(), tenants.load(), reviews.load()]);

const json = (res, data, status = 200) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
};

const body = async (req) => {
  let data = "";
  for await (const chunk of req) { data += chunk; if (data.length > 5_000_000) throw new Error("Request body is too large"); }
  try { return data ? JSON.parse(data) : {}; } catch { throw new Error("Request body must be valid JSON"); }
};

// Constant-time comparison so the token cannot be recovered by timing the response.
const authorized = (req) => {
  const presented = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(presented);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/" || url.pathname === "/index.html") {
      const html = await readFile(resolve(appRoot, "operator", "console.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    // Everything below is operator-only.
    if (!authorized(req)) return json(res, { error: "Operator token required" }, 401);

    if (url.pathname === "/api/overview" && req.method === "GET") {
      const versions = registry.listVersions();
      return json(res, {
        ...tenants.overview(),
        plugins: registry.list().length,
        versions: versions.length,
        blocked: versions.filter((version) => version.blocked).length,
        publicKey: signingKeys.publicKey,
      });
    }

    if (url.pathname === "/api/plugin-analytics" && req.method === "GET") {
      return json(res, pluginAnalytics(registry.list(), tenants.list()));
    }

    if (url.pathname === "/api/operator-assistant" && req.method === "POST") {
      const input = await body(req);
      const recommendations = operatorRecommendations(registry.list(), tenants.list());
      const query = String(input.query ?? "").toLowerCase();
      const filtered = query ? recommendations.filter((item) => JSON.stringify(item).toLowerCase().includes(query)) : recommendations;
      return json(res, { recommendations: filtered, scope: "operator-metadata-only" });
    }

    if (url.pathname === "/api/packages" && req.method === "GET") return json(res, packages.list({ includeDisabled: true }));
    if (url.pathname.startsWith("/api/packages/") && url.pathname.endsWith("/status") && req.method === "POST") { const parts = url.pathname.split("/"); const input = await body(req); const record = packages.setStatus(parts[3], parts[4], parts[5], input.status, { changedBy: input.changedBy ?? "operator", reason: input.reason ?? "" }); await packages.save(); return json(res, record); }

    if (url.pathname === "/api/tenants" && req.method === "GET") {
      return json(res, tenants.list().map((tenant) => ({
        ...tenant, health: tenants.health(tenant.tenantId), slots: tenants.slots(tenant.tenantId),
      })));
    }

    if (url.pathname === "/api/tenants" && req.method === "POST") {
      return json(res, await tenants.register(await body(req)), 201);
    }

    if (url.pathname.startsWith("/api/tenants/") && req.method === "POST") {
      const [, , , tenantId, action] = url.pathname.split("/");
      const input = await body(req);
      if (action === "plan") return json(res, await tenants.setPlan(tenantId, input.plan));
      if (action === "channel") return json(res, await tenants.setChannel(tenantId, input.channel));
      if (action === "grant") return json(res, await tenants.grant(tenantId, input.pluginId));
      if (action === "revoke") return json(res, await tenants.revoke(tenantId, input.pluginId));
      if (action === "user") return json(res, await tenants.addUser(tenantId, input.userId, input.name));
      if (action === "remove-user") return json(res, await tenants.removeUser(tenantId, input.userId));
      if (action === "assign") return json(res, await tenants.assignPlugin(tenantId, input.pluginId, input.userId));
      if (action === "unassign") return json(res, await tenants.unassignPlugin(tenantId, input.pluginId, input.userId));
      throw new Error(`Unknown tenant action: ${action}`);
    }

    if (url.pathname === "/api/plugins" && req.method === "GET") {
      return json(res, registry.list().map((plugin) => ({
        ...plugin, versions: registry.listVersions(plugin.id).map(({ files, ...rest }) => rest),
      })));
    }

    if (url.pathname === "/api/releases" && req.method === "POST") {
      const input = await body(req);
      const [, , , action] = url.pathname.split("/");
      return json(res, await registry.promote(input.pluginId, input.version, input.channel));
    }

    if (url.pathname === "/api/releases/block" && req.method === "POST") {
      const input = await body(req);
      const record = input.blocked === false
        ? await registry.unblockVersion(input.pluginId, input.version)
        : await registry.blockVersion(input.pluginId, input.version, input.reason);
      audit.record({ action: input.blocked === false ? "registry.unblocked" : "registry.blocked", pluginId: input.pluginId, version: input.version, reason: input.reason });
      const { files, ...rest } = record;
      return json(res, rest);
    }

    if (url.pathname === "/api/rollouts" && req.method === "POST") {
      const input = await body(req);
      return json(res, await registry.startRollout(input));
    }

    if (url.pathname === "/api/rollouts/advance" && req.method === "POST") {
      const input = await body(req);
      return json(res, await registry.advanceRollout(input.pluginId, input.version));
    }

    if (url.pathname === "/api/rollouts/pause" && req.method === "POST") {
      const input = await body(req);
      return json(res, await registry.pauseRollout(input.pluginId, input.version, input.paused !== false));
    }

    // Plugin Studio: inspect a repository, then publish it deliberately.
    if (url.pathname === "/api/studio/inspect" && req.method === "POST") {
      const input = await body(req);
      const source = input.repositoryUrl
        ? await importRepository({ repositoryUrl: input.repositoryUrl, ref: input.ref, importRoot })
        : { path: resolve(input.path), repositoryUrl: null, ref: null };
      const inspection = await pipeline.inspect(source.path, { pluginId: input.pluginId, version: input.version, channel: input.channel, requestedOutcome: input.requestedOutcome });
      inspection.source = { repositoryUrl: source.repositoryUrl, ref: source.ref };
      const review = inspection.needsReview.length ? await reviews.submit(inspection, { requestedBy: input.requestedBy ?? "operator" }) : null;
      // The file contents are the package, not console material.
      const { files, ...rest } = inspection;
      studioCache.set(`${rest.pluginId}@${rest.version}`, inspection);
      return json(res, { ...rest, fileCount: Object.keys(files ?? {}).length, reviewId: review?.id ?? null, reviewStatus: review?.status ?? "not-required" });
    }

    if (url.pathname === "/api/studio/publish" && req.method === "POST") {
      const input = await body(req);
      const inspection = studioCache.get(`${input.pluginId}@${input.version}`);
      if (!inspection) throw new Error("Inspect the repository again before publishing.");
      if (inspection.needsReview.length) {
        const review = reviews.get(input.reviewId);
        if (!review || review.status !== "approved") throw new Error("This package needs an approved review before publishing.");
      }
      const release = await pipeline.publish(inspection, { channel: input.channel, approvedBy: input.approvedBy, notes: input.notes });
      const { files, ...rest } = release;
      return json(res, rest, 201);
    }

    if (url.pathname === "/api/audit" && req.method === "GET") {
      return json(res, audit.list().slice(-200).reverse());
    }

    if (url.pathname === "/api/reviews" && req.method === "GET") return json(res, reviews.list({ status: url.searchParams.get("status") || undefined }).map(({ inspection, ...record }) => ({ ...record, needsReview: inspection.needsReview, report: inspection.report })));
    if (url.pathname.startsWith("/api/reviews/") && url.pathname.endsWith("/decide") && req.method === "POST") { const reviewId = url.pathname.split("/")[3]; const input = await body(req); const record = await reviews.decide(reviewId, input); audit.record({ action: `studio.review-${input.decision}`, reviewId, pluginId: record.pluginId, version: record.version, approvedBy: input.approvedBy }); return json(res, { ...record, inspection: undefined }); }

    return json(res, { error: "Not found" }, 404);
  } catch (error) {
    json(res, { error: error.message }, 400);
  }
});

// Holds the last inspection per plugin version so publishing does not re-scan, and so the
// thing published is exactly the thing that was reviewed.
const studioCache = new Map();

const port = Number(process.env.OPERATOR_PORT ?? 4180);
const host = process.env.OPERATOR_HOST ?? "127.0.0.1";
server.listen(port, host, () => console.log(`BusinessOS Operator: http://${host}:${port}`));
