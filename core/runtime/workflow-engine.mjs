import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class WorkflowEngine {
  constructor({ policyEngine, eventBus, audit, stateFile } = {}) {
    this.policyEngine = policyEngine;
    this.eventBus = eventBus;
    this.audit = audit;
    this.stateFile = stateFile;
    this.runs = new Map();
  }

  async load() {
    if (!this.stateFile) return this.list();
    try { for (const run of JSON.parse(await readFile(this.stateFile, "utf8"))) this.runs.set(run.id, run); }
    catch (error) { if (error.code !== "ENOENT") throw error; await this.save(); }
    return this.list();
  }

  async save() { if (this.stateFile) { await mkdir(dirname(this.stateFile), { recursive: true }); await writeFile(this.stateFile, JSON.stringify(this.list(), null, 2)); } }

  async request(action) {
    if (!action?.name) throw new Error("Action name is required");
    if (!action.tenantId) throw new Error("Workflow tenantId is required");
    if (action.idempotencyKey) {
      const existing = this.list({ tenantId: action.tenantId }).find((run) => run.idempotencyKey === action.idempotencyKey && !["failed", "rejected"].includes(run.status));
      if (existing) return existing;
    }
    const decision = this.policyEngine.evaluate(action);
    const timestamp = new Date().toISOString();
    const run = { id: randomUUID(), tenantId: action.tenantId, action: action.name, capability: action.capability ?? null, input: action.input ?? {}, preview: action.preview ?? null, evidence: action.evidence ?? [], expectedEffect: action.expectedEffect ?? null, oldValue: action.oldValue ?? null, newValue: action.newValue ?? null, idempotencyKey: action.idempotencyKey ?? randomUUID(), risk: decision.risk, policy: decision, status: decision.allowed ? (decision.requiresApproval ? "awaiting-approval" : "completed") : "blocked", attempts: 0, checkpoints: [{ status: "created", at: timestamp }], createdAt: timestamp, updatedAt: timestamp };
    this.runs.set(run.id, run);
    await this.save();
    this.audit?.record({ action: `workflow.${run.status}`, workflowId: run.id, risk: run.risk, capability: run.capability });
    await this.eventBus?.emit({ type: `workflow.${run.status}`, workflow: run });
    return run;
  }

  async decide(id, decision, { tenantId, comment = "", editedInput } = {}) {
    const run = this.runs.get(id);
    if (!run || run.status !== "awaiting-approval") throw new Error("Workflow is not awaiting approval");
    if (tenantId && run.tenantId !== tenantId) throw new Error("Workflow does not belong to this tenant");
    run.status = decision === "approved" ? "completed" : "rejected";
    run.decidedAt = new Date().toISOString();
    run.updatedAt = run.decidedAt; run.comment = comment;
    if (editedInput) run.input = editedInput;
    run.checkpoints.push({ status: run.status, at: run.decidedAt });
    await this.save();
    this.audit?.record({ action: `workflow.${run.status}`, workflowId: run.id });
    await this.eventBus?.emit({ type: `workflow.${run.status}`, workflow: run });
    return run;
  }

  list({ tenantId, status } = {}) { return [...this.runs.values()].filter((run) => (!tenantId || run.tenantId === tenantId) && (!status || run.status === status)).sort((left, right) => right.createdAt.localeCompare(left.createdAt)); }
}
