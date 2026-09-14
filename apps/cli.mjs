import { resolve } from "node:path";
import { AuditLog, EventBus, PluginManager, PolicyEngine } from "../core/runtime/index.mjs";

const audit = new AuditLog();
const events = new EventBus();
const manager = new PluginManager({ root: resolve("plugins"), audit, eventBus: events });
await manager.discover();
const order = manager.resolveOrder();
for (const id of order) await manager.enable(id);
const policy = new PolicyEngine();

console.log(JSON.stringify({
  discoveredPlugins: manager.list().length,
  enabledPlugins: manager.list().filter((plugin) => plugin.status === "enabled").length,
  dependencyOrder: order,
  samplePolicy: policy.evaluate({ action: "publish-google-post", risk: "high" }),
  auditEntries: audit.list().length,
}, null, 2));
