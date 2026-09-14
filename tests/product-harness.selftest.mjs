import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthService, CredentialVault, ModelRouter, parseCatalog, TenantStore } from "../core/runtime/index.mjs";

const root = await mkdtemp(join(tmpdir(), "businessos-product-"));
const auth = new AuthService({ stateFile: join(root, "auth.json") });
await auth.load();
const account = await auth.register({ name: "Owner", email: "owner@example.com", password: "long-enough-password" });
assert.equal(auth.authenticate(account.session.token).email, "owner@example.com");

const tenants = new TenantStore({ stateFile: join(root, "tenants.json") });
await tenants.load();
const products = parseCatalog("sku,name,category,price,cost\nBRO-100,Brochures,Print,1200,700");
const catalog = await tenants.importCatalog(account.user, products);
assert.equal(catalog[0].sku, "BRO-100");
assert.equal((await tenants.updateProfile(account.user, { businessName: "ABizCreator" })).businessName, "ABizCreator");

const vault = new CredentialVault({ stateFile: join(root, "vault.json"), keyFile: join(root, "vault.key") });
await vault.load(); await vault.set(account.user.id, "gemini", "test-secret");
assert.equal(vault.get(account.user.id, "gemini"), "test-secret");
assert.equal(new ModelRouter({ configured: (provider) => vault.has(account.user.id, provider) }).select({ mode: "economical" }).provider, "gemini");
await rm(root, { recursive: true, force: true });
console.log("product harness self-test passed");
