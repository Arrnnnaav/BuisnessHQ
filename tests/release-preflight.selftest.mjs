import assert from "node:assert/strict";
import { resolve } from "node:path";
import { runPreflight } from "../scripts/release-preflight.mjs";

const staging = await runPreflight({ root: resolve("."), target: "staging", env: {} });
assert.equal(staging.verdict, "PASS", staging.errors.join("\n"));
assert.equal(staging.summary.plugins, 18);
assert.equal(staging.summary.packages, 8);
assert.ok(staging.plugins.find((item) => item.id === "catalog")?.readiness.installable);
assert.ok(staging.plugins.find((item) => item.id === "meta-ads-team")?.readiness.installable);
assert.equal(staging.plugins.find((item) => item.id === "crm")?.readiness.installable, false);

const blocked = await runPreflight({ root: resolve("."), target: "pilot", env: {} });
assert.equal(blocked.verdict, "BLOCKED");
assert.ok(blocked.errors.some((error) => error.startsWith("customer-consent:")));

const approved = await runPreflight({ root: resolve("."), target: "pilot", env: {
  CUSTOMER_PILOT_APPROVED: "1",
  OPERATOR_TOKEN: "a".repeat(32),
  BUSINESSOS_AI_CONFIGURED: "1",
  BUSINESSOS_TLS_TERMINATED: "1",
  BUSINESSOS_BACKUP_CONFIGURED: "1",
  BUSINESSOS_EXTERNAL_WRITES: "0",
} });
assert.equal(approved.verdict, "PASS", approved.errors.join("\n"));
console.log("release preflight self-test passed");
