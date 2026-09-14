import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PricingAgentService } from "../core/runtime/index.mjs";

const dataRoot = await mkdtemp(join(tmpdir(), "businessos-pricing-"));
const service = new PricingAgentService({ projectRoot: resolve("."), dataRoot, runner: async (_command, args) => { const output = args[args.indexOf("--output") + 1]; await writeFile(output, JSON.stringify({ external_effects: false, catalog_items_accepted: 1, recommendations: [{ sku: "TEST-1", status: "needs-owner-approval" }] })); return { stdout: "simulated runner", stderr: "" }; } });
assert.throws(() => service.validateCatalog([{ sku: "missing", name: "Missing cost" }]), /verified selling price and cost/);
const run = await service.stage("owner-test", [{ sku: "TEST-1", name: "Test service", category: "Testing", price: 1000, cost: 600, currency: "INR" }]);
assert.equal(run.external_effects, false);
assert.equal(run.recommendations[0].status, "needs-owner-approval");
assert.equal(JSON.parse(await readFile(run.outputFile, "utf8")).catalog_items_accepted, 1);
await rm(dataRoot, { recursive: true, force: true });
console.log("pricing agent bridge self-test passed");
