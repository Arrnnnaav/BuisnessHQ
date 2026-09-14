import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { AuditLog, EventBus, PluginLifecycle, PluginManager } from "../core/runtime/index.mjs";

const dir = await mkdtemp(join(tmpdir(), "businessos-lifecycle-"));
const stateFile = join(dir, "installations.json");
const audit = new AuditLog();
const events = new EventBus();
const plugins = new PluginManager({ root: resolve("plugins") });
await plugins.discover();

const lifecycle = new PluginLifecycle({ stateFile, pluginManager: plugins, audit, eventBus: events });
await lifecycle.load();

const TENANT = "owner-1";
const OTHER = "owner-2";

// Nothing is installed until the owner installs it. The runtime discovering 17 manifests
// is not the same as a company having 17 apps.
assert.equal(lifecycle.list(TENANT).length, 0);
assert.equal(lifecycle.catalog(TENANT).length, plugins.list().length);
assert.equal(lifecycle.catalog(TENANT).every((app) => app.installed === false), true);

// Section 84: a fresh company starts with the starter set, plus whatever they depend on.
await lifecycle.ensureDefaults(TENANT);
const installedIds = lifecycle.list(TENANT).map((record) => record.pluginId);
for (const id of ["catalog", "seo", "pricing"]) assert.ok(installedIds.includes(id), `${id} should be installed`);
// The SEO pilot uses the verified company URL directly. The unfinished website app is
// not silently installed as a fake dependency.
assert.equal(installedIds.includes("website"), false);
assert.equal(lifecycle.catalog(TENANT).find((app) => app.id === "website").installable, false);

// Installing reports which dependencies were brought in, so the UI can say so.
const crm = await lifecycle.install(TENANT, "crm");
assert.equal(crm.alreadyInstalled, false);
assert.deepEqual(crm.broughtIn, []);
assert.equal((await lifecycle.install(TENANT, "crm")).alreadyInstalled, true);

// Newly installed apps land at the bottom of Growth Apps.
assert.equal(lifecycle.navigationFor(TENANT).tree().plugins.at(-1).id, "crm");

// Installations are per tenant and do not leak.
assert.equal(lifecycle.list(OTHER).length, 0);
await lifecycle.install(OTHER, "catalog");
assert.equal(lifecycle.list(OTHER).length, 1);
assert.equal(lifecycle.navigationFor(OTHER).tree().plugins.length, 1);
assert.ok(lifecycle.list(TENANT).length > 1);

// Disable keeps the record and the nav entry, but marks it inactive (section 9).
await lifecycle.disable(TENANT, "crm");
assert.equal(lifecycle.list(TENANT).find((record) => record.pluginId === "crm").state, "disabled");
const disabledEntry = lifecycle.navigationFor(TENANT).tree().plugins.find((item) => item.id === "crm");
assert.equal(disabledEntry.active, false);
assert.equal(lifecycle.health(TENANT, "crm").status, "disabled");
await lifecycle.enable(TENANT, "crm");
assert.equal(lifecycle.health(TENANT, "crm").status, "healthy");

// Dependency guards: pricing relies on catalog, so catalog cannot be turned off or
// removed while pricing remains active.
await assert.rejects(() => lifecycle.disable(TENANT, "catalog"), /Pricing & Revenue Intelligence/);
await assert.rejects(() => lifecycle.uninstall(TENANT, "catalog"), /Pricing & Revenue Intelligence/);
await lifecycle.disable(TENANT, "pricing");
assert.equal(lifecycle.health(TENANT, "pricing").status, "disabled");

// Uninstall removes navigation entirely and records the data decision separately.
assert.equal(lifecycle.navigationFor(TENANT).tree().plugins.some((item) => item.id === "seo"), true);
assert.equal(audit.list({ action: "plugin.data-deleted" }).length, 0);
await lifecycle.install(TENANT, "reviews");
await lifecycle.uninstall(TENANT, "reviews", { keepData: false });
assert.equal(audit.list({ action: "plugin.data-deleted" }).length, 1);
assert.equal(audit.list({ action: "plugin.uninstalled" }).at(-1).dataRetained, false);

// An app whose dependency is off reports attention, not healthy. Re-enabling pricing
// while catalog is disabled must not silently re-enable catalog behind the owner's back.
await lifecycle.disable(TENANT, "catalog");
await lifecycle.enable(TENANT, "pricing");
assert.equal(lifecycle.list(TENANT).find((record) => record.pluginId === "catalog").state, "disabled");
const degraded = lifecycle.health(TENANT, "pricing");
assert.equal(degraded.status, "attention");
assert.deepEqual(degraded.missing, ["catalog"]);
// Turning the dependency back on clears it without touching pricing.
await lifecycle.enable(TENANT, "catalog");
assert.equal(lifecycle.health(TENANT, "pricing").status, "healthy");

// Update is a no-op when the manifest version already matches what is installed.
assert.equal((await lifecycle.update(TENANT, "catalog")).updated, false);
const stale = lifecycle.list(TENANT).find((record) => record.pluginId === "catalog");
stale.version = "0.9.0";
assert.equal(lifecycle.catalog(TENANT).find((app) => app.id === "catalog").updateAvailable, true);
const updated = await lifecycle.update(TENANT, "catalog");
assert.equal(updated.updated, true);
assert.equal(updated.to, plugins.manifestFor("catalog").version);

// Unknown apps and uninstalled apps fail loudly rather than silently succeeding.
await assert.rejects(() => lifecycle.install(TENANT, "not-a-real-app"), /Unknown app/);
await assert.rejects(() => lifecycle.disable(TENANT, "quotations"), /not installed/);

// State survives a restart.
const reloaded = new PluginLifecycle({ stateFile, pluginManager: plugins, audit });
await reloaded.load();
assert.deepEqual(
  reloaded.list(TENANT).map((record) => record.pluginId),
  lifecycle.list(TENANT).map((record) => record.pluginId),
);
assert.equal(reloaded.list(OTHER).length, 1);
// Navigation must survive a restart too: a registry built from disk records, not from
// the install calls that happened to run in this process.
assert.deepEqual(
  reloaded.navigationFor(TENANT).tree().plugins.map((item) => item.id),
  lifecycle.navigationFor(TENANT).tree().plugins.map((item) => item.id),
);
assert.ok(reloaded.navigationFor(TENANT).tree().plugins.length > 0);
assert.ok(JSON.parse(await readFile(stateFile, "utf8")).length > 0);

await rm(dir, { recursive: true, force: true });
console.log(`plugin lifecycle self-test passed (${lifecycle.list(TENANT).length} apps installed for tenant)`);
