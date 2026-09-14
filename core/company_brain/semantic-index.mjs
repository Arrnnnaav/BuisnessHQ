import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const cosine = (left, right) => { let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0; for (let index = 0; index < Math.min(left.length, right.length); index += 1) { dot += left[index] * right[index]; leftMagnitude += left[index] ** 2; rightMagnitude += right[index] ** 2; } return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0; };

export class SemanticIndex {
  constructor({ stateFile, embed } = {}) { this.stateFile = stateFile; this.embed = embed; this.documents = new Map(); }
  async load() { try { const state = JSON.parse(await readFile(this.stateFile, "utf8")); for (const document of state.documents ?? []) this.documents.set(document.id, document); } catch (error) { if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error; this.documents.clear(); await this.save(); } return this.list(); }
  async save() { await mkdir(dirname(this.stateFile), { recursive: true }); const temporary = `${this.stateFile}.tmp`; await writeFile(temporary, JSON.stringify({ documents: this.list() }, null, 2)); await rename(temporary, this.stateFile); }
  async upsert(records) { const normalized = records.filter((record) => record?.id && record?.text); if (!normalized.length) return []; const embeddings = await this.embed(normalized.map((record) => record.text)); const timestamp = new Date().toISOString(); normalized.forEach((record, index) => this.documents.set(record.id, { ...record, embedding: embeddings[index], updatedAt: timestamp })); await this.save(); return normalized.map((record) => record.id); }
  async search(query, { limit = 8, type } = {}) { if (!query || !this.documents.size) return []; const [embedding] = await this.embed([query]); return this.list().filter((document) => !type || document.type === type).map((document) => ({ ...document, score: cosine(embedding, document.embedding) })).sort((left, right) => right.score - left.score).slice(0, limit).map(({ embedding: _embedding, ...document }) => document); }
  async remove(id) { const removed = this.documents.delete(id); if (removed) await this.save(); return removed; }
  list() { return [...this.documents.values()]; }
}

export class SemanticIndexRegistry {
  constructor({ dataRoot, embed } = {}) { this.dataRoot = dataRoot; this.embed = embed; this.indexes = new Map(); }
  async get(tenantId) { if (!/^[a-zA-Z0-9-]+$/.test(tenantId)) throw new Error("Invalid tenant identifier"); if (!this.indexes.has(tenantId)) { const index = new SemanticIndex({ stateFile: resolve(this.dataRoot, tenantId, "semantic-index.json"), embed: this.embed }); await index.load(); this.indexes.set(tenantId, index); } return this.indexes.get(tenantId); }
}
