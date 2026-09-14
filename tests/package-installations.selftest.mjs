import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TenantStore } from "../core/runtime/index.mjs";

const store = new TenantStore({ stateFile: join(await mkdtemp(join(tmpdir(), "businessos-package-installations-")), "tenants.json") });
const owner = { id: "owner-1", email: "owner@example.com" };
const manifest = { type: "skill", id: "email-curation", version: "1.0.0", capabilities: ["email.draft"] };
assert.equal((await store.installPackage(owner, manifest)).state, "enabled");
assert.equal((await store.installPackage(owner, manifest)).id, "email-curation");
const upgraded = await store.installPackage(owner, { ...manifest, version: "1.0.1", capabilities: ["email.draft", "email.classify"] });
assert.equal(upgraded.version, "1.0.1");
assert.equal(upgraded.history[0].version, "1.0.0");
assert.equal((await store.setPackageState(owner, "skill", "email-curation", "disabled")).state, "disabled");
assert.equal((await store.uninstallPackage(owner, "skill", "email-curation")).removed, true);
assert.equal((await store.get(owner)).packages.length, 0);
console.log("package installation self-test passed");
