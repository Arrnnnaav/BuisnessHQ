import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const issues = [];
let manifest;

try {
  manifest = JSON.parse(readFileSync(resolve(pluginRoot, "manifest.json"), "utf8"));
  for (const field of ["id", "name", "version", "description"]) if (!manifest[field]) issues.push(`manifest is missing ${field}`);
} catch (error) {
  issues.push(`manifest cannot be read: ${error.message}`);
}

for (const [name, relativePath] of Object.entries(manifest?.fileStructure ?? {})) {
  if (!existsSync(resolve(pluginRoot, relativePath))) issues.push(`declared ${name} path is missing: ${relativePath}`);
}

const permissions = [...(manifest?.permissions?.required ?? []), ...(manifest?.permissions?.optional ?? [])];
for (const permission of permissions) if (!/^(read|write|execute|admin):[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)*$/.test(permission)) issues.push(`invalid permission: ${permission}`);

const result = {
  pluginId: manifest?.id ?? "catalog",
  status: issues.length ? "attention" : "healthy",
  checks: {
    manifest: Boolean(manifest),
    declaredPaths: Object.keys(manifest?.fileStructure ?? {}).length,
    permissions: permissions.length,
    externalServices: "not-required",
  },
  issues,
};

console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exitCode = 1;
