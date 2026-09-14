import assert from "node:assert/strict";
import { resolve } from "node:path";
import { AuditLog, EventBus, PluginManager, PolicyEngine } from "../core/runtime/index.mjs";

const manager = new PluginManager({ root: resolve("plugins") });
const plugins = await manager.discover();
assert.ok(plugins.length >= 10);
const order = manager.resolveOrder(["seo"]);
assert.ok(order.indexOf("website") < order.indexOf("seo"));

const events = new EventBus();
const audit = new AuditLog();
const wiredManager = new PluginManager({ root: resolve("plugins"), eventBus: events, audit });
await wiredManager.discover();
let enabled = false;
events.on("plugin.enabled", () => { enabled = true; });
await wiredManager.enable("catalog");
assert.equal(enabled, true);
assert.equal(audit.list({ action: "plugin.enabled" }).length, 1);
assert.match(audit.list({ action: "plugin.enabled" })[0].hash, /^[a-f0-9]{64}$/);
assert.equal(new PolicyEngine().evaluate({ risk: "low" }).requiresApproval, false);
assert.equal(new PolicyEngine().evaluate({ risk: "high" }).requiresApproval, true);
assert.equal(new PolicyEngine().evaluate({ capability: "wordpress.production.publish" }).allowed, false);
assert.equal(new PolicyEngine().evaluate({ capability: "wordpress.page.delete" }).allowed, false);
console.log(`runtime self-test passed (${plugins.length} plugins discovered)`);
