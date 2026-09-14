import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { assessPluginReadiness } from "../plugins/plugin-readiness.mjs";

// Existing scaffold manifests contain explanatory // comments. This parser keeps
// those manifests loadable while new manifests should remain strict JSON.
function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inLineComment) { if (char === "\n") { inLineComment = false; output += char; } continue; }
    if (inBlockComment) { if (char === "*" && next === "/") { inBlockComment = false; index += 1; } continue; }
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; output += char; continue; }
    if (char === "/" && next === "/") { inLineComment = true; index += 1; continue; }
    if (char === "/" && next === "*") { inBlockComment = true; index += 1; continue; }
    output += char;
  }
  return output.replace(/,\s*([}\]])/g, "$1");
}

async function walk(dir) {
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...(await walk(path)));
    else if (entry.name === "manifest.json") results.push(path);
  }
  return results;
}

export class PluginManager {
  constructor({ root, audit, eventBus } = {}) {
    this.root = root;
    this.audit = audit;
    this.eventBus = eventBus;
    this.plugins = new Map();
  }

  async discover() {
    const manifestPaths = await walk(this.root);
    for (const manifestPath of manifestPaths) {
      const raw = await readFile(manifestPath, "utf8");
      let manifest;
      try {
        manifest = JSON.parse(raw);
      } catch (error) {
        try {
          manifest = JSON.parse(stripJsonComments(raw));
        } catch (fallbackError) {
          throw new Error(`Invalid manifest ${manifestPath}: ${fallbackError.message}`);
        }
      }
      this.#validate(manifest, manifestPath);
      if (this.plugins.has(manifest.id)) throw new Error(`Duplicate plugin id: ${manifest.id}`);
      const path = dirname(manifestPath);
      this.plugins.set(manifest.id, { manifest, path, readiness: assessPluginReadiness(manifest, path), status: "discovered" });
    }
    return this.list();
  }

  list() {
    return [...this.plugins.values()].map(({ manifest, path, readiness, status }) => ({
      id: manifest.id, name: manifest.name, version: manifest.version,
      category: manifest.category ?? "uncategorized", path: relative(this.root, path), readiness, status,
    }));
  }

  resolveOrder(ids = [...this.plugins.keys()]) {
    const visiting = new Set();
    const visited = new Set();
    const order = [];
    const visit = (id) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error(`Plugin dependency cycle at ${id}`);
      const plugin = this.plugins.get(id);
      if (!plugin) throw new Error(`Missing plugin dependency: ${id}`);
      visiting.add(id);
      for (const dependency of plugin.manifest.dependencies ?? []) visit(dependency);
      visiting.delete(id); visited.add(id); order.push(id);
    };
    ids.forEach(visit);
    return order;
  }

  manifestFor(id) {
    return this.plugins.get(id)?.manifest ?? null;
  }

  readinessFor(id) { return this.plugins.get(id)?.readiness ?? null; }

  async registerDirectory(path) {
    const raw = await readFile(join(path, "plugin.json"), "utf8");
    const manifest = JSON.parse(raw);
    this.#validate(manifest, join(path, "plugin.json"));
    this.plugins.set(manifest.id, { manifest, path, readiness: assessPluginReadiness(manifest, path), status: this.plugins.get(manifest.id)?.status ?? "discovered" });
    return this.plugins.get(manifest.id);
  }

  async enable(id) {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Unknown plugin: ${id}`);
    plugin.status = "enabled";
    this.audit?.record({ action: "plugin.enabled", pluginId: id });
    await this.eventBus?.emit({ type: "plugin.enabled", pluginId: id });
    return plugin;
  }

  // Disable keeps code and data (GrowthOS plan section 9). Uninstall, which removes the
  // runtime and asks the owner about data retention, is phase 2 and deliberately absent.
  async disable(id) {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Unknown plugin: ${id}`);
    plugin.status = "disabled";
    this.audit?.record({ action: "plugin.disabled", pluginId: id });
    await this.eventBus?.emit({ type: "plugin.disabled", pluginId: id });
    return plugin;
  }

  #validate(manifest, path) {
    for (const field of ["id", "name", "version", "description"]) {
      if (typeof manifest[field] !== "string" || !manifest[field]) throw new Error(`Invalid ${field} in ${path}`);
    }
    if (!/^[a-z][a-z0-9_-]*$/.test(manifest.id)) throw new Error(`Invalid plugin id: ${manifest.id}`);
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error(`Invalid plugin version: ${manifest.id}`);
  }
}
