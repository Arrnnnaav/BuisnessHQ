import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SemanticIndex } from "../core/runtime/index.mjs";

const root = await mkdtemp(join(tmpdir(), "businessos-semantic-"));
const vectors = new Map([["brochure printing", [1, 0]], ["negative review", [0, 1]], ["brochure price", [0.95, 0.05]]]);
const index = new SemanticIndex({ stateFile: join(root, "index.json"), embed: async (values) => values.map((value) => vectors.get(value) ?? [0.5, 0.5]) });
await index.load();
await index.upsert([{ id: "catalog:1", type: "catalog", text: "brochure printing" }, { id: "knowledge:1", type: "knowledge", text: "negative review" }]);
assert.equal((await index.search("brochure price"))[0].id, "catalog:1");
const recovered = new SemanticIndex({ stateFile: join(root, "index.json"), embed: index.embed });
await recovered.load(); assert.equal(recovered.list().length, 2);
await writeFile(join(root, "corrupt.json"), "");
const repaired = new SemanticIndex({ stateFile: join(root, "corrupt.json"), embed: index.embed });
await repaired.load(); assert.deepEqual(repaired.list(), []);
await rm(root, { recursive: true, force: true });
console.log("semantic index self-test passed");
