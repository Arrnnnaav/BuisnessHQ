import { createHash, randomUUID } from "node:crypto";

const TYPES = new Set(["low_ctr", "ranking_gap", "ranking_drop", "wrong_intent", "cannibalization"]);
const freeze = (value) => Object.freeze(structuredClone(value));
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalize = (row) => ({ query: String(row.query ?? row.keys?.[0] ?? "").trim(), page: String(row.page ?? row.keys?.[1] ?? "").trim(), clicks: Number(row.clicks ?? 0), impressions: Number(row.impressions ?? 0), ctr: Number(row.ctr ?? 0), position: Number(row.position ?? 0), previousPosition: row.previousPosition == null ? null : Number(row.previousPosition) });

export class SeoOpportunityEngine {
  classify(row, rows) {
    if (rows.filter((candidate) => candidate.query === row.query && candidate.page && candidate.page !== row.page).length) return "cannibalization";
    if (row.previousPosition != null && row.position - row.previousPosition >= 3) return "ranking_drop";
    if (row.impressions >= 100 && row.position >= 3 && row.position <= 10 && row.ctr < 0.02) return "low_ctr";
    if (row.impressions >= 50 && row.position > 10 && row.position <= 20) return "ranking_gap";
    return "wrong_intent";
  }

  discover({ tenantId, rows, pages = [], companyBrainRefs = [], searchConsoleSnapshotRef, period = "last_28_days" }) {
    const normalized = rows.map(normalize).filter((row) => row.query && row.impressions > 0);
    return normalized.map((row) => {
      const type = this.classify(row, normalized); if (!TYPES.has(type)) throw new Error("Unsupported SEO opportunity type");
      const page = pages.find((candidate) => candidate.url === row.page);
      const businessValue = companyBrainRefs.some((reference) => row.query.toLowerCase().includes(String(reference.value ?? "").toLowerCase())) ? 0.95 : 0.7;
      const evidence = freeze({ query: row.query, page: row.page, period, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position, previousPosition: row.previousPosition, opportunityType: type, baselineMetrics: { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }, companyBrainRefs: companyBrainRefs.map((reference) => reference.id), websiteSnapshotRef: page?.snapshotRef ?? null, searchConsoleSnapshotRef });
      return { id: randomUUID(), tenantId, type, page: row.page, primaryQuery: row.query, businessValue, confidence: Math.min(0.98, 0.65 + Math.min(row.impressions / 10_000, 0.25) + (page ? 0.08 : 0)), evidence, evidenceHash: hash(evidence), status: "discovered", createdAt: new Date().toISOString() };
    }).sort((left, right) => (right.businessValue * right.confidence) - (left.businessValue * left.confidence));
  }
}

export { TYPES as SEO_OPPORTUNITY_TYPES };
