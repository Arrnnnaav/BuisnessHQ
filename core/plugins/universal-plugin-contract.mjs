export const PLUGIN_CONTRACT = "businessos-plugin/v1";

const RUNTIMES = new Set(["native", "node", "python", "wasm", "container", "mcp", "api"]);
const PERMISSIONS = new Set([
  "network", "filesystem.read", "filesystem.write", "database.read", "database.write",
  "secrets.read", "system.shell", "process.spawn",
]);

// Two manifest shapes exist in the wild: the contract's flat `permissions: []`, and the
// richer `permissions: { required: [], optional: [] }` the bundled plugins use. Reading
// either is cheap; crashing on one of them is not acceptable in a validator whose whole
// job is to reject bad input gracefully.
export function declaredPermissions(plugin) {
  const declared = plugin?.permissions;
  if (Array.isArray(declared)) return declared;
  if (declared && typeof declared === "object") return declared.required ?? [];
  return [];
}

export function validatePluginContract(plugin) {
  const errors = [];
  if (!plugin || typeof plugin !== "object") return { valid: false, errors: ["a plugin manifest object is required"] };
  if (plugin.schema !== PLUGIN_CONTRACT) errors.push(`schema must be ${PLUGIN_CONTRACT}`);
  for (const field of ["id", "name", "version"]) {
    if (typeof plugin[field] !== "string" || !plugin[field]) errors.push(`${field} is required`);
  }
  if (!plugin.runtime?.type || !RUNTIMES.has(plugin.runtime.type)) errors.push("runtime.type is unsupported");
  if (!Array.isArray(plugin.capabilities) || plugin.capabilities.length === 0) errors.push("at least one capability is required");
  for (const permission of declaredPermissions(plugin)) {
    if (!PERMISSIONS.has(permission)) errors.push(`unsupported permission: ${permission}`);
  }
  return { valid: errors.length === 0, errors };
}

export function capabilityKey(capability) {
  return typeof capability === "string" ? capability : capability?.id;
}
