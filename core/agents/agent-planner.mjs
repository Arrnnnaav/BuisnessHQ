import { createHash, randomUUID } from "node:crypto";

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
};

export function classifyAgentRequest({ goal, clarifications = [] } = {}) {
  const questions = Array.isArray(clarifications) ? clarifications.filter(Boolean) : [];
  if (!String(goal ?? "").trim() || questions.length) return { kind: "clarification", questions: questions.length ? questions : ["What outcome should BusinessOS prepare?"] };
  return { kind: "plan", goal: String(goal).trim() };
}

export function validateAgentGraph({ nodes = [], capabilities = [] } = {}) {
  const providers = new Map((capabilities ?? []).map((item) => [item.id ?? item, item.providers ?? []]));
  const errors = [];
  if (!Array.isArray(nodes) || nodes.length === 0) errors.push("An agent plan needs at least one node");
  const ids = new Set();
  for (const node of nodes) {
    if (!node?.id || ids.has(node.id)) errors.push(`Node ids must be unique: ${node?.id ?? "missing"}`);
    ids.add(node?.id);
    if (!node?.capability || !providers.has(node.capability)) errors.push(`Unknown capability: ${node?.capability ?? "missing"}`);
    const available = providers.get(node?.capability) ?? [];
    if (node?.pluginId && !available.some((provider) => provider.pluginId === node.pluginId)) errors.push(`Capability '${node.capability}' is not provided by plugin '${node.pluginId}'`);
    if (node?.effectKey && nodes.filter((candidate) => candidate.effectKey === node.effectKey).length > 1) errors.push(`Duplicate side effect: ${node.effectKey}`);
  }
  for (const node of nodes) for (const dependency of node.dependsOn ?? []) if (!ids.has(dependency)) errors.push(`Node '${node.id}' depends on unknown node '${dependency}'`);
  const visiting = new Set(); const visited = new Set(); const order = [];
  const visit = (id) => { if (visiting.has(id)) { errors.push(`Plan contains a cycle at '${id}'`); return; } if (visited.has(id)) return; visiting.add(id); const node = nodes.find((candidate) => candidate.id === id); for (const dependency of node?.dependsOn ?? []) if (ids.has(dependency)) visit(dependency); visiting.delete(id); visited.add(id); order.push(id); };
  for (const node of nodes) visit(node.id);
  return { valid: errors.length === 0, errors: [...new Set(errors)], order };
}

export function createAgentPlan({ tenantId, goal, nodes, capabilities, context = {}, createdBy = "owner" } = {}) {
  if (!tenantId) throw new Error("Agent plan tenantId is required");
  const classification = classifyAgentRequest({ goal });
  if (classification.kind !== "plan") throw new Error(classification.questions.join(" "));
  const validation = validateAgentGraph({ nodes, capabilities });
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  const plan = { id: randomUUID(), tenantId, goal: classification.goal, nodes: structuredClone(nodes), context: structuredClone(context), validation, status: "proposed", approvalRequired: true, createdBy, createdAt: new Date().toISOString() };
  plan.digest = createHash("sha256").update(canonical({ goal: plan.goal, nodes: plan.nodes, context: plan.context })).digest("hex");
  return plan;
}
