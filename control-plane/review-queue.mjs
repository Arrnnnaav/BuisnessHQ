import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export class ReviewQueue {
  constructor({ stateFile } = {}) { this.stateFile = stateFile; this.records = new Map(); }
  async load() {
    if (!this.stateFile) return this;
    try { for (const record of JSON.parse(await readFile(this.stateFile, "utf8"))) this.records.set(record.id, record); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    return this;
  }
  async save() { if (this.stateFile) { await mkdir(dirname(this.stateFile), { recursive: true }); await writeFile(this.stateFile, JSON.stringify([...this.records.values()], null, 2)); } }
  async submit(inspection, { requestedBy = "operator" } = {}) {
    if (!inspection?.pluginId || !inspection?.version) throw new Error("A valid inspection is required");
    const record = { id: randomUUID(), pluginId: inspection.pluginId, version: inspection.version, requestedBy, status: "pending", inspection, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.records.set(record.id, record); await this.save(); return record;
  }
  async decide(id, { decision, approvedBy, notes = "" } = {}) {
    const record = this.records.get(id);
    if (!record) throw new Error("Review not found");
    if (!["approved", "rejected"].includes(decision)) throw new Error("Review decision must be approved or rejected");
    if (!approvedBy) throw new Error("A named reviewer is required");
    record.status = decision; record.approvedBy = approvedBy; record.notes = notes; record.updatedAt = new Date().toISOString(); await this.save(); return record;
  }
  get(id) { return this.records.get(id) ?? null; }
  list({ status } = {}) { return [...this.records.values()].filter((record) => !status || record.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
}
