import assert from "node:assert/strict";
import { listSetupPlaybooks, setupPlaybook } from "../core/runtime/index.mjs";

assert.equal(listSetupPlaybooks().length, 3);
const wordpress = setupPlaybook("wordpress");
assert.equal(wordpress.steps.length, 4);
assert.ok(wordpress.steps.every((step) => !JSON.stringify(step).match(/(password|secret|token|credential)\s*[:=]\s*\S+/i)));
assert.throws(() => setupPlaybook("unknown"), /Unknown setup playbook/);
console.log("pointai setup self-test passed");
