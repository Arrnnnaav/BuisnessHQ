import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLog, CapabilityRegistry, Marketplace, analyzeRepository, validatePluginContract } from "../core/runtime/index.mjs";

const root = await mkdtemp(join(tmpdir(), "businessos-repo-"));
const stateFile = join(root, "marketplace.json");
await writeFile(join(root, "README.md"), "Run the tool with --help");
await writeFile(join(root, "pyproject.toml"), "[project]\nname='demo'");
const analysis = await analyzeRepository(root);
assert.equal(analysis.compatibility.label, "CLI Compatible");

const audit = new AuditLog();
const registry = new CapabilityRegistry();
const marketplace = new Marketplace({ stateFile, audit, capabilityRegistry: registry });
const entry = await marketplace.registerGithub({ url: "https://github.com/example/demo", analyzerResult: analysis });
assert.equal(entry.status, "pending-review");
const contract = { schema: "businessos-plugin/v1", id: "demo", name: "Demo", version: "1.0.0", runtime: { type: "container" }, capabilities: ["demo.run"], permissions: ["filesystem.read"] };
assert.equal(validatePluginContract(contract).valid, true);
await marketplace.install(entry.id, contract);
await marketplace.setEnabled(entry.id, true);
assert.equal(registry.find("demo.run")[0].pluginId, entry.id);
assert.equal(await marketplace.remove(entry.id), true);
await rm(root, { recursive: true, force: true });
console.log("marketplace self-test passed");
