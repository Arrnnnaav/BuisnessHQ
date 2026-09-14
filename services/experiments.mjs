const STATUSES = new Set(["draft", "running", "data_sufficient", "winner", "loser", "inconclusive", "archived"]);

export class ExperimentEngine {
  constructor() { this.experiments = new Map(); }
  create({ clientId, hypothesis, control, variant, budgetLimit = 0 } = {}) {
    if (!clientId || !hypothesis || !control || !variant) throw new Error("An experiment needs a client, hypothesis, control, and variant");
    const experiment = { id: `exp_${this.experiments.size + 1}`, clientId, hypothesis, control, variant, budgetLimit: Number(budgetLimit), status: "draft", decision: null, createdAt: new Date().toISOString() };
    this.experiments.set(experiment.id, experiment); return experiment;
  }
  transition(id, status, { decision = null } = {}) {
    if (!STATUSES.has(status)) throw new Error(`Unknown experiment status: ${status}`);
    const experiment = this.experiments.get(id); if (!experiment) throw new Error("Experiment not found");
    const allowed = { draft: ["running", "archived"], running: ["data_sufficient", "inconclusive", "archived"], data_sufficient: ["winner", "loser", "inconclusive", "archived"], winner: ["archived"], loser: ["archived"], inconclusive: ["archived"], archived: [] };
    if (!allowed[experiment.status].includes(status)) throw new Error(`Cannot move experiment from ${experiment.status} to ${status}`);
    experiment.status = status; if (decision) experiment.decision = decision; experiment.updatedAt = new Date().toISOString(); return experiment;
  }
  list(clientId) { return [...this.experiments.values()].filter((item) => !clientId || item.clientId === clientId); }
}
