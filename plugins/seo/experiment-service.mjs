import { randomUUID } from "node:crypto";

const transitions = { CREATED: ["AWAITING_APPROVAL", "VALIDATION_FAILED", "CANCELLED"], AWAITING_APPROVAL: ["APPROVED", "REJECTED", "VALIDATION_FAILED", "CANCELLED"], APPROVED: ["STAGING_WRITE_STARTED", "CANCELLED"], STAGING_WRITE_STARTED: ["VERIFICATION_PENDING", "STAGING_WRITE_FAILED"], VERIFICATION_PENDING: ["ACTIVE", "VERIFICATION_FAILED"], ACTIVE: ["MEASURING", "CANCELLED"], MEASURING: ["COMPLETED", "CANCELLED"] };

export class SeoExperimentService {
  create({ tenantId, opportunity, proposal, validation }) {
    if (!validation.passed) throw new Error("Cannot create an experiment from a failed validation");
    const timestamp = new Date().toISOString();
    return { id: randomUUID(), tenantId, opportunityId: opportunity.id, page: opportunity.page, hypothesis: `A more query-aligned title and meta description will improve CTR for ${opportunity.primaryQuery}.`, primaryMetric: "search_console_ctr", secondaryMetrics: ["clicks", "position", "leads"], baseline: structuredClone(opportunity.evidence.baselineMetrics), evidence: structuredClone(opportunity.evidence), evidenceHash: opportunity.evidenceHash, proposalVersions: [proposal], approvedVersion: null, approvedPayloadHash: null, status: "CREATED", history: [{ status: "CREATED", at: timestamp }], measurementWindows: [7, 14, 28], createdAt: timestamp, updatedAt: timestamp };
  }
  transition(experiment, status, details = {}) { if (!(transitions[experiment.status] ?? []).includes(status)) throw new Error(`Invalid SEO experiment transition ${experiment.status} → ${status}`); const at = new Date().toISOString(); return { ...experiment, ...details, status, updatedAt: at, history: [...experiment.history, { status, at, ...details.event }] }; }
  addProposal(experiment, proposal) { if (!["CREATED", "AWAITING_APPROVAL"].includes(experiment.status)) throw new Error("Proposal is frozen after approval"); return { ...experiment, proposalVersions: [...experiment.proposalVersions, { ...proposal, version: experiment.proposalVersions.length + 1 }] }; }
}
