import { resolve } from "node:path";
import { CompanyBrain } from "./engine.mjs";

export class CompanyBrainRegistry {
  constructor({ dataRoot } = {}) { this.dataRoot = dataRoot; this.brains = new Map(); }

  async get(tenantId) {
    if (!/^[a-zA-Z0-9-]+$/.test(tenantId)) throw new Error("Invalid tenant identifier");
    if (!this.brains.has(tenantId)) {
      const brain = new CompanyBrain({ stateFile: resolve(this.dataRoot, tenantId, "company-brain.json") });
      await brain.load(); this.brains.set(tenantId, brain);
    }
    return this.brains.get(tenantId);
  }
}
