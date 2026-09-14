import { randomUUID } from "node:crypto";

const SUPPORTED_ACTIONS = new Set(["seo.audit", "content.draft", "gbp.publish", "review.reply", "email.send", "pricing.recommendation"]);

export class SandboxConnector {
  constructor({ audit } = {}) { this.audit = audit; this.runs = []; }

  execute({ action, input = {} }) {
    if (!SUPPORTED_ACTIONS.has(action)) throw new Error(`Unsupported sandbox action: ${action}`);
    const run = { id: randomUUID(), action, input, mode: "simulation", status: "simulated", externalEffects: false, createdAt: new Date().toISOString(), result: this.#result(action, input) };
    this.runs.unshift(run); this.audit?.record({ action: "sandbox.action-simulated", sandboxAction: action, runId: run.id });
    return run;
  }

  list() { return [...this.runs]; }

  #result(action, input) {
    if (action === "seo.audit") return { score: 71, findings: ["Title tag needs local service intent", "Canonical NAP is incomplete", "Add LocalBusiness schema"], nextStep: "Create an owner-approved website change draft" };
    if (action === "content.draft") return { title: `${input.service ?? "Business"} in ${input.city ?? "your city"}`, status: "draft-ready", checks: ["brand voice", "catalog grounding", "approval policy"] };
    if (action === "gbp.publish") return { destination: "Google Business Profile simulator", status: "held-as-draft", previewUrl: `/sandbox/gbp/${randomUUID()}` };
    if (action === "review.reply") return { sentiment: input.rating && Number(input.rating) <= 2 ? "negative" : "positive", status: input.rating && Number(input.rating) <= 2 ? "owner-escalation-simulated" : "auto-reply-simulated" };
    if (action === "email.send") return { recipient: input.recipient ?? "demo@example.com", status: "delivered-to-sandbox-inbox" };
    return { recommendation: "No live price change was made", confidence: 0.82, status: "approval-simulated" };
  }
}
