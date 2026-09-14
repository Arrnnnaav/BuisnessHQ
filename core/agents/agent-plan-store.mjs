import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class AgentPlanStore {
  constructor({ stateFile } = {}) { this.stateFile = stateFile; this.plans = new Map(); }
  async load() { if (!this.stateFile) return this; try { for (const plan of JSON.parse(await readFile(this.stateFile, "utf8"))) this.plans.set(plan.id, plan); } catch (error) { if (error.code !== "ENOENT") throw error; } return this; }
  async save() { if (this.stateFile) { await mkdir(dirname(this.stateFile), { recursive: true }); await writeFile(this.stateFile, JSON.stringify([...this.plans.values()], null, 2)); } }
  async create(plan) { this.plans.set(plan.id, plan); await this.save(); return plan; }
  async decide(tenantId, id, status, { comment = "" } = {}) { const plan = this.get(tenantId, id); if (!plan) throw new Error("Agent plan not found"); if (plan.status !== "proposed") throw new Error("Agent plan is already decided"); if (!["approved", "rejected"].includes(status)) throw new Error("Unknown agent plan decision"); plan.status = status; plan.comment = comment; plan.decidedAt = new Date().toISOString(); await this.save(); return plan; }
  get(tenantId, id) { const plan = this.plans.get(id); return plan?.tenantId === tenantId ? plan : null; }
  list(tenantId) { return [...this.plans.values()].filter((plan) => !tenantId || plan.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
}
