import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { AuditLog, EventBus, PluginManager, PolicyEngine } from "../core/runtime/index.mjs";

test("discovers scaffold manifests and resolves dependencies", async () => {
  const manager = new PluginManager({ root: resolve("plugins") });
  const plugins = await manager.discover();
  assert.ok(plugins.length >= 10);
  const order = manager.resolveOrder(["seo"]);
  assert.ok(order.indexOf("website") < order.indexOf("seo"));
});

test("events, policy, and audit form the execution boundary", async () => {
  const events = new EventBus();
  const audit = new AuditLog();
  const manager = new PluginManager({ root: resolve("plugins"), eventBus: events, audit });
  await manager.discover();
  let enabled = false;
  events.on("plugin.enabled", () => { enabled = true; });
  await manager.enable("catalog");
  assert.equal(enabled, true);
  assert.equal(audit.list({ action: "plugin.enabled" }).length, 1);
  assert.equal(new PolicyEngine().evaluate({ risk: "low" }).requiresApproval, false);
  assert.equal(new PolicyEngine().evaluate({ risk: "high" }).requiresApproval, true);
});
