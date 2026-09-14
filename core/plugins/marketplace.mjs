import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validatePluginContract } from "./universal-plugin-contract.mjs";

export class Marketplace {
  constructor({ stateFile, audit, capabilityRegistry } = {}) {
    this.stateFile = stateFile;
    this.audit = audit;
    this.capabilityRegistry = capabilityRegistry;
    this.entries = new Map();
  }

  async load() {
    if (!this.stateFile) return this.list();
    try {
      const state = JSON.parse(await readFile(this.stateFile, "utf8"));
      for (const entry of state) this.entries.set(entry.id, entry);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    return this.list();
  }

  async save() {
    if (this.stateFile) await writeFile(this.stateFile, JSON.stringify(this.list(), null, 2));
  }

  async registerGithub({ url, commit = "unreviewed", analyzerResult = null }) {
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(url)) throw new Error("Only public GitHub repository URLs are supported");
    const entry = {
      id: `github-${randomUUID()}`, source: { type: "github", url, commit },
      status: "pending-review", compatibility: analyzerResult?.compatibility ?? null,
      capabilities: analyzerResult?.declaredPlugin?.capabilities ?? [], permissions: [],
      installMode: "adapter-required",
    };
    this.entries.set(entry.id, entry); await this.save();
    this.audit?.record({ action: "marketplace.github-registered", pluginId: entry.id, source: url });
    return entry;
  }

  async install(id, contract) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown marketplace entry: ${id}`);
    const result = validatePluginContract(contract);
    if (!result.valid) throw new Error(`Plugin contract rejected: ${result.errors.join(", ")}`);
    entry.contract = contract; entry.capabilities = contract.capabilities;
    entry.permissions = contract.permissions ?? []; entry.status = "installed"; entry.enabled = false;
    this.capabilityRegistry?.register(id, entry.capabilities);
    await this.save();
    this.audit?.record({ action: "marketplace.plugin-installed", pluginId: id });
    return entry;
  }

  async setEnabled(id, enabled) {
    const entry = this.entries.get(id);
    if (!entry || entry.status !== "installed") throw new Error(`Plugin is not installed: ${id}`);
    entry.enabled = enabled; await this.save();
    this.audit?.record({ action: enabled ? "marketplace.plugin-enabled" : "marketplace.plugin-disabled", pluginId: id });
    return entry;
  }

  async remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return false;
    this.entries.delete(id); await this.save();
    this.audit?.record({ action: "marketplace.plugin-removed", pluginId: id });
    return true;
  }

  list() { return [...this.entries.values()]; }
}
