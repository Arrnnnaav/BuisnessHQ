import assert from "node:assert/strict";
import { resolve } from "node:path";
import { AuditLog, EventBus, NavigationRegistry, PluginManager } from "../core/runtime/index.mjs";

const events = new EventBus();
const audit = new AuditLog();
const manager = new PluginManager({ root: resolve("plugins"), eventBus: events, audit });
await manager.discover();

const navigation = new NavigationRegistry({ audit }).attach(events, manager);

// Sections are fixed and plugins start empty (plan section 39).
const empty = navigation.tree();
assert.deepEqual(empty.core.map((item) => item.id), ["home", "company-brain", "needs-you", "ask", "business-profile", "tasks"]);
assert.deepEqual(empty.platform.map((item) => item.id), ["apps", "marketplace", "connections", "test-lab", "activity", "settings"]);
assert.equal(empty.plugins.length, 0);

// Acceptance criterion 2: installing appends to the BOTTOM of Growth Apps, in install order.
for (const id of ["catalog", "seo", "pricing"]) navigation.register(manager.manifestFor(id));
assert.deepEqual(navigation.tree().plugins.map((item) => item.id), ["catalog", "seo", "pricing"]);
navigation.register(manager.manifestFor("crm"));
assert.deepEqual(navigation.tree().plugins.map((item) => item.id), ["catalog", "seo", "pricing", "crm"]);

// Re-registering (an update) must not reorder an app the owner already placed.
navigation.register(manager.manifestFor("catalog"), { state: "enabled" });
assert.equal(navigation.tree().plugins[0].id, "catalog");

// Routes are derived, never manifest-supplied, so a plugin cannot claim an arbitrary path.
assert.equal(navigation.routeFor("seo"), "/apps/seo");
assert.equal(navigation.routeFor("home"), "/home");

// A plugin may not shadow a core or platform destination.
assert.throws(() => navigation.register({ id: "home", name: "Impostor" }), /reserved navigation id/);
assert.throws(() => navigation.register({ id: "marketplace", name: "Impostor" }), /reserved navigation id/);

// Acceptance criterion 3: disabling marks the entry inactive but keeps it listed.
await manager.enable("seo");
assert.equal(navigation.tree().plugins.find((item) => item.id === "seo").active, true);
await manager.disable("seo");
const disabled = navigation.tree().plugins.find((item) => item.id === "seo");
assert.equal(disabled.state, "disabled");
assert.equal(disabled.active, false);
assert.equal(navigation.tree({ includeHidden: false }).plugins.some((item) => item.id === "seo"), false);

// Acceptance criterion 4: uninstalling removes navigation entirely.
await events.emit({ type: "plugin.uninstalled", pluginId: "seo" });
assert.equal(navigation.tree().plugins.some((item) => item.id === "seo"), false);
assert.equal(navigation.routeFor("seo"), null);

// Lifecycle changes are auditable.
assert.ok(audit.list({ action: "navigation.registered" }).length >= 4);
assert.equal(audit.list({ action: "navigation.unregistered" }).length, 1);

console.log(`navigation self-test passed (${navigation.tree().plugins.length} growth apps registered)`);
