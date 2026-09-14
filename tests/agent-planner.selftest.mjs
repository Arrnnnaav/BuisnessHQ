import assert from "node:assert/strict";
import { classifyAgentRequest, createAgentPlan, validateAgentGraph } from "../core/runtime/index.mjs";

const capabilities = [{ id: "slides.create", providers: [{ pluginId: "powerpoint" }] }, { id: "slides.verify", providers: [{ pluginId: "powerpoint" }] }];
assert.equal(classifyAgentRequest({ goal: "", clarifications: [] }).kind, "clarification");
assert.equal(classifyAgentRequest({ goal: "Build a deck" }).kind, "plan");
const nodes = [{ id: "create", pluginId: "powerpoint", capability: "slides.create", effectKey: "deck:create" }, { id: "verify", pluginId: "powerpoint", capability: "slides.verify", dependsOn: ["create"] }];
assert.equal(validateAgentGraph({ nodes, capabilities }).valid, true);
const plan = createAgentPlan({ tenantId: "owner-1", goal: "Build a deck", nodes, capabilities, context: { audience: "investors" } });
assert.equal(plan.status, "proposed"); assert.equal(plan.approvalRequired, true); assert.equal(plan.validation.order.join(","), "create,verify"); assert.equal(plan.digest.length, 64);
assert.deepEqual(validateAgentGraph({ nodes: [nodes[1], nodes[0]], capabilities }).order, ["create", "verify"]);
assert.equal(validateAgentGraph({ capabilities, nodes: [{ ...nodes[0], capability: "shell.exec" }] }).valid, false);
assert.match(validateAgentGraph({ capabilities, nodes: [{ ...nodes[0], capability: "shell.exec" }] }).errors.join(" "), /Unknown capability/);
assert.match(validateAgentGraph({ capabilities, nodes: [{ ...nodes[0], id: "a", dependsOn: ["b"] }, { ...nodes[1], id: "b", dependsOn: ["a"] }] }).errors.join(" "), /cycle/);
assert.match(validateAgentGraph({ capabilities, nodes: [{ ...nodes[0], effectKey: "same" }, { ...nodes[1], effectKey: "same" }] }).errors.join(" "), /Duplicate side effect/);
console.log("agent planner self-test passed");
