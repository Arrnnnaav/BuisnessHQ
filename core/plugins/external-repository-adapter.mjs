/**
 * A GitHub repository is an upstream source, not an installed plugin by itself.
 * This registry records an adapter contract so we can pin, review, and map only
 * selected capabilities into BusinessOS without copying an entire application.
 */
export const externalRepositories = [
  {
    id: "compai-crm",
    url: "https://github.com/trycompai/crm",
    license: "MIT",
    role: "reference-and-adapter",
    capabilities: ["crm", "evidence-ledger", "durable-agent-work-queue"],
    integrationPlan: "Map CRM records and evidence concepts behind the BusinessOS CRM plugin; keep BusinessOS policy, audit, and approvals as the authority.",
  },
  {
    id: "open-seo",
    url: "https://github.com/every-app/open-seo",
    license: "MIT",
    role: "connector-or-adapter",
    capabilities: ["keyword-research", "rank-tracking", "site-audits", "competitor-insights", "mcp-agent-skills"],
    integrationPlan: "Expose SEO data through a BusinessOS connector and translate results into Company Brain evidence; do not let external skills bypass BusinessOS policy or approval gates.",
  },
];
