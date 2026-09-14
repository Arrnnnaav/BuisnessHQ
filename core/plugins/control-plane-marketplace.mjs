import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { verifyPackage } from "../../control-plane/package-signing.mjs";
import { validatePluginContract } from "./universal-plugin-contract.mjs";

const safePath = (root, relativePath) => {
  if (!relativePath || relativePath.includes("\\") || relativePath.split("/").some((part) => part === ".." || part === "." || part === "")) throw new Error("Package contains an unsafe file path");
  const destination = resolve(root, relativePath);
  if (!destination.startsWith(resolve(root) + sep)) throw new Error("Package file escaped its installation directory");
  return destination;
};
const compareVersions = (left, right) => {
  const a = String(left).split(".").map(Number); const b = String(right).split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) { const difference = (a[index] ?? 0) - (b[index] ?? 0); if (difference) return difference; }
  return 0;
};

export class ControlPlaneMarketplace {
  constructor({ registryFile, publicKeyFile, installRoot } = {}) { this.registryFile = registryFile; this.publicKeyFile = publicKeyFile; this.installRoot = installRoot; this.state = { plugins: [], versions: [] }; this.publicKey = null; }
  async load() {
    try { this.state = JSON.parse(await readFile(this.registryFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
    try { this.publicKey = JSON.parse(await readFile(this.publicKeyFile, "utf8")).publicKey; } catch (error) { if (error.code !== "ENOENT") throw error; }
    return this;
  }
  catalog({ tenantId = "", channel = "stable", coreVersion = "99.0.0" } = {}) {
    const rank = { development: 0, alpha: 1, beta: 2, stable: 3 };
    const plugins = new Map((this.state.plugins ?? []).filter((plugin) => plugin.status === "published").map((plugin) => [plugin.id, plugin]));
    return [...plugins.values()].filter((plugin) => plugin.visibility !== "private" || (plugin.tenants ?? []).includes(tenantId)).map((plugin) => {
      const versions = (this.state.versions ?? []).filter((item) => item.pluginId === plugin.id && !item.blocked && rank[item.channel] >= rank[channel] && rank[item.channel] <= 3 && rank[item.channel] >= 0 && compareVersions(coreVersion, item.minimumCoreVersion) >= 0).sort((a, b) => compareVersions(b.version, a.version));
      const release = versions[0];
      return { id: plugin.id, name: plugin.name, description: plugin.description, category: plugin.category, publisher: plugin.publisher, version: release?.version ?? null, channel: release?.channel ?? null, permissions: release?.permissions ?? [], available: Boolean(release), installable: Boolean(release), tenantId };
    }).filter((item) => item.available);
  }
  async install(pluginId, { version, tenantId = "", channel = "stable", coreVersion = "99.0.0" } = {}) {
    const plugin = this.catalog({ tenantId, channel, coreVersion }).find((item) => item.id === pluginId);
    if (!plugin) throw new Error("That plugin is not published or available for this installation.");
    if (version && version !== plugin.version) throw new Error("The requested version is not the current available release for this channel.");
    return this.installVersion(pluginId, plugin.version, { tenantId, channel, coreVersion });
  }
  async installVersion(pluginId, version, { tenantId = "", channel = "stable", coreVersion = "99.0.0" } = {}) {
    const plugin = (this.state.plugins ?? []).find((item) => item.id === pluginId && item.status === "published");
    if (!plugin) throw new Error("That plugin is not published or available for this installation.");
    const rank = { development: 0, alpha: 1, beta: 2, stable: 3 };
    const record = (this.state.versions ?? []).find((item) => item.pluginId === pluginId && item.version === version && !item.blocked && rank[item.channel] >= rank[channel] && compareVersions(coreVersion, item.minimumCoreVersion) >= 0);
    if (!record) throw new Error("That signed release is not available for this installation.");
    const verified = verifyPackage({ ...record, publicKey: this.publicKey });
    if (!verified.valid) throw new Error(`Package verification failed: ${verified.reason}`);
    let manifest;
    try { manifest = JSON.parse(record.files?.["plugin.json"] ?? ""); } catch { throw new Error("Published package does not contain valid plugin.json"); }
    const contract = validatePluginContract(manifest);
    if (!contract.valid) throw new Error(`Published package contract failed: ${contract.errors.join(", ")}`);
    const destination = resolve(this.installRoot, pluginId);
    await mkdir(destination, { recursive: true });
    for (const [relativePath, content] of Object.entries(record.files ?? {})) await writeFile(safePath(destination, relativePath), content, "utf8");
    return { pluginId, version: record.version, path: destination, checksum: record.checksum, verified: true };
  }
}
