import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const PACKAGE_TYPES = ["plugin", "skill", "agent", "mcp"];
const safeId = /^[a-z0-9][a-z0-9._-]*$/;
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
};
const digest = (value, serialize = canonical) => createHash("sha256").update(serialize(value)).digest("hex");
const manifestFromRecord = ({ digest: _digest, status: _status, publishedAt: _publishedAt, history: _history, ...manifest }) => manifest;

export function validatePackageManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") return { valid: false, errors: ["a package manifest object is required"] };
  if (!PACKAGE_TYPES.includes(manifest.type)) errors.push(`type must be one of ${PACKAGE_TYPES.join(", ")}`);
  if (typeof manifest.id !== "string" || !safeId.test(manifest.id)) errors.push("id must be a lowercase package id");
  if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version ?? ""))) errors.push("version must look like 1.2.3");
  if (manifest.publisher !== "GhostCursor" || manifest.firstParty !== true) errors.push("only first-party packages may be published in this marketplace");
  if (!Array.isArray(manifest.capabilities)) errors.push("capabilities must be an array");
  if (manifest.type === "agent" && !Array.isArray(manifest.skills)) errors.push("agents must declare skills");
  if (manifest.type === "mcp" && !manifest.connector) errors.push("MCP packages must declare a connector");
  if (manifest.executable === true) errors.push("arbitrary executable package code is not allowed");
  return { valid: errors.length === 0, errors };
}

export class FirstPartyPackageRegistry {
  constructor({ stateFile } = {}) { this.stateFile = stateFile; this.packages = new Map(); }
  async load() {
    if (!this.stateFile) return this;
    try {
      for (const record of JSON.parse(await readFile(this.stateFile, "utf8"))) {
        const manifest = manifestFromRecord(record);
        const expected = digest(manifest);
        const legacy = digest(manifest, JSON.stringify);
        if (record.digest && record.digest !== expected && record.digest !== legacy) throw new Error(`Package integrity check failed: ${record.type}:${record.id}@${record.version}`);
        record.digest = expected;
        this.packages.set(`${record.type}:${record.id}@${record.version}`, record);
      }
    }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    return this;
  }
  async save() { if (this.stateFile) { await mkdir(dirname(this.stateFile), { recursive: true }); await writeFile(this.stateFile, JSON.stringify([...this.packages.values()], null, 2)); } }
  publish(manifest) {
    const result = validatePackageManifest(manifest);
    if (!result.valid) throw new Error(result.errors.join(", "));
    const key = `${manifest.type}:${manifest.id}@${manifest.version}`;
    if (this.packages.has(key)) throw new Error(`${key} is already published`);
    const record = { ...structuredClone(manifest), digest: digest(manifest), status: "published", publishedAt: new Date().toISOString() };
    this.packages.set(key, record);
    return record;
  }
  list({ type, includeDisabled = false } = {}) { return [...this.packages.values()].filter((item) => (!type || item.type === type) && (includeDisabled || item.status !== "disabled")); }
  setStatus(type, id, version, status, { changedBy = "operator", reason = "" } = {}) {
    const record = this.packages.get(`${type}:${id}@${version}`);
    if (!record) throw new Error("Package release not found");
    if (!["published", "disabled", "deprecated"].includes(status)) throw new Error("Unknown package status");
    if (record.status !== status) {
      record.history = [...(record.history ?? []), { from: record.status, to: status, changedBy, reason, at: new Date().toISOString() }];
    }
    record.status = status;
    return record;
  }
}
