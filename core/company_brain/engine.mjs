import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const KNOWLEDGE_TYPES = new Set(["fact", "policy", "procedure", "decision", "learning", "metric"]);
const STATUSES = new Set(["verified", "fresh", "possibly-stale", "stale", "conflicting", "inferred", "suggested"]);

const tokens = (value) => String(value ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
const text = (record) => [record.key, record.value, record.type, ...(record.tags ?? [])].join(" ");

export class CompanyBrain {
  constructor({ stateFile, seed = [] } = {}) {
    this.stateFile = stateFile;
    this.seed = seed;
    this.records = new Map();
    this.skills = new Map();
  }

  async load() {
    if (!this.stateFile) return this.snapshot();
    try {
      const state = JSON.parse(await readFile(this.stateFile, "utf8"));
      for (const record of state.records ?? []) this.records.set(record.id, record);
      for (const skill of state.skills ?? []) this.skills.set(skill.id, skill);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      for (const sourceRecord of this.seed) {
        const id = sourceRecord.id ?? randomUUID();
        this.records.set(id, { ...sourceRecord, id, createdAt: sourceRecord.createdAt ?? new Date().toISOString(), updatedAt: sourceRecord.updatedAt ?? new Date().toISOString() });
      }
      await this.save();
    }
    return this.snapshot();
  }

  async save() {
    if (!this.stateFile) return;
    await mkdir(dirname(this.stateFile), { recursive: true });
    await writeFile(this.stateFile, JSON.stringify(this.snapshot(), null, 2));
  }

  list({ type, status } = {}) {
    return [...this.records.values()]
      .filter((record) => (!type || record.type === type) && (!status || record.status === status))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async add(input, { verifiedBy = null } = {}) {
    if (!KNOWLEDGE_TYPES.has(input.type ?? "fact")) throw new Error("Unsupported knowledge type");
    if (!String(input.key ?? "").trim() || !String(input.value ?? "").trim()) throw new Error("Knowledge key and value are required");
    if (input.status && !STATUSES.has(input.status)) throw new Error("Unsupported knowledge status");
    const timestamp = new Date().toISOString();
    const record = {
      id: randomUUID(), type: input.type ?? "fact", key: input.key.trim(), value: input.value.trim(),
      source: String(input.source ?? "owner input").trim() || "owner input", confidence: Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : 1,
      status: input.status ?? "verified", tags: [...new Set((input.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean))],
      verifiedBy, evidence: input.evidence ?? [], validFrom: input.validFrom ?? timestamp, validTo: input.validTo ?? null,
      createdAt: timestamp, updatedAt: timestamp,
    };
    this.records.set(record.id, record);
    this.#markConflicts(record);
    await this.save();
    return record;
  }

  async addSkill(input) {
    if (!String(input.name ?? "").trim() || !Array.isArray(input.steps) || input.steps.length === 0) throw new Error("A skill name and at least one step are required");
    const timestamp = new Date().toISOString();
    const skill = { id: randomUUID(), name: input.name.trim(), description: input.description?.trim() || "", requiredContext: input.requiredContext ?? [], guardrails: input.guardrails ?? [], steps: input.steps, createdAt: timestamp, updatedAt: timestamp };
    this.skills.set(skill.id, skill);
    await this.save();
    return skill;
  }

  resolve(query, { limit = 8, types } = {}) {
    const queryTokens = new Set(tokens(query));
    const eligible = this.list().filter((record) => !types || types.includes(record.type));
    const ranked = eligible.map((record) => {
      const haystack = new Set(tokens(text(record)));
      const matches = [...queryTokens].filter((token) => haystack.has(token)).length;
      const statusBoost = record.status === "verified" ? 0.5 : record.status === "fresh" ? 0.25 : 0;
      return { ...record, relevance: matches + record.confidence + statusBoost };
    }).filter((record) => record.relevance > 0).sort((left, right) => right.relevance - left.relevance).slice(0, limit);
    return { query, records: ranked, skills: [...this.skills.values()].filter((skill) => tokens(`${skill.name} ${skill.description}`).some((token) => queryTokens.has(token))).slice(0, limit) };
  }

  async recordOutcome({ observation, classification = "learning", evidence = [], confidence = 0.6 }) {
    if (!KNOWLEDGE_TYPES.has(classification)) throw new Error("Unsupported outcome classification");
    return this.add({ type: classification, key: "agent_outcome", value: observation, source: "agent outcome", evidence, confidence, status: "suggested", tags: ["outcome"] });
  }

  snapshot() { return { records: this.list(), skills: [...this.skills.values()] }; }

  #markConflicts(record) {
    const conflicts = this.list().filter((candidate) => candidate.id !== record.id && candidate.type === record.type && candidate.key.toLowerCase() === record.key.toLowerCase() && candidate.value.toLowerCase() !== record.value.toLowerCase() && !candidate.validTo);
    if (!conflicts.length) return;
    record.status = "conflicting";
    for (const conflict of conflicts) conflict.status = "conflicting";
  }
}
