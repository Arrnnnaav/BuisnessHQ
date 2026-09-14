import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export class AuditLog {
  #entries = [];

  constructor({ stateFile } = {}) {
    this.stateFile = stateFile;
    if (stateFile && existsSync(stateFile)) this.#entries = readFileSync(stateFile, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }

  record(entry) {
    const normalized = {
      id: entry.id ?? crypto.randomUUID(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      ...entry,
    };
    normalized.previousHash = this.#entries.at(-1)?.hash ?? null;
    normalized.hash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
    this.#entries.push(normalized);
    if (this.stateFile) { mkdirSync(dirname(this.stateFile), { recursive: true }); appendFileSync(this.stateFile, `${JSON.stringify(normalized)}\n`); }
    return structuredClone(normalized);
  }

  list(filter = {}) {
    return this.#entries.filter((entry) =>
      Object.entries(filter).every(([key, value]) => entry[key] === value),
    );
  }
}
