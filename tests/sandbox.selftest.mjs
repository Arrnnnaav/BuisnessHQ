import assert from "node:assert/strict";
import { AuditLog, SandboxConnector } from "../core/runtime/index.mjs";

const audit = new AuditLog();
const sandbox = new SandboxConnector({ audit });
const seo = sandbox.execute({ action: "seo.audit", input: { url: "https://example.com" } });
const post = sandbox.execute({ action: "gbp.publish", input: { content: "Test post" } });
assert.equal(seo.externalEffects, false);
assert.equal(post.result.status, "held-as-draft");
assert.equal(audit.list({ action: "sandbox.action-simulated" }).length, 2);
console.log("sandbox self-test passed");
