const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };
const HARD_DENIED_CAPABILITIES = new Set(["wordpress.production.publish", "wordpress.page.delete"]);

export class PolicyEngine {
  constructor({ approvalRisk = "high" } = {}) {
    this.approvalRisk = approvalRisk;
  }

  evaluate(action) {
    const risk = action.risk ?? "high";
    if (HARD_DENIED_CAPABILITIES.has(action.capability)) return { allowed: false, requiresApproval: false, risk: "critical", reason: `Capability '${action.capability}' is hard-disabled` };
    const requiresApproval = RISK_ORDER[risk] >= RISK_ORDER[this.approvalRisk];
    return {
      allowed: action.allowed !== false,
      requiresApproval,
      risk,
      reason: requiresApproval
        ? `Risk level '${risk}' requires owner approval`
        : "Action is within the automatic execution threshold",
    };
  }
}

export { HARD_DENIED_CAPABILITIES };
