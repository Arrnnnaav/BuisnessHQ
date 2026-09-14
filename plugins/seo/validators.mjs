import { createHash } from "node:crypto";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const result = (code, passed, message) => ({ code, passed, message });
const words = (value) => String(value ?? "").toLowerCase().match(/[a-z0-9₹$]+/g) ?? [];

export class SeoPrePublishValidator {
  validate({ proposal, currentPage, verifiedServices = [], verifiedLocations = [], knownPrices = [] }) {
    const title = String(proposal.proposed.title ?? "").trim(); const meta = String(proposal.proposed.metaDescription ?? "").trim(); const combined = `${title} ${meta}`;
    const checks = [
      result("target-url", proposal.targetUrl === currentPage.url, "Target URL matches the snapshotted page"),
      result("title-length", title.length >= 25 && title.length <= 65, `Title length is ${title.length}; required 25–65`),
      result("meta-length", meta.length >= 70 && meta.length <= 170, `Meta description length is ${meta.length}; required 70–170`),
      result("canonical-preserved", !proposal.proposed.canonical || proposal.proposed.canonical === currentPage.canonical, "Canonical is unchanged"),
      result("indexing-preserved", !/noindex/i.test(proposal.proposed.robots ?? ""), "No accidental noindex directive"),
      result("h1-preserved", proposal.proposed.h1 == null, "V1 cannot modify H1"),
      result("service-grounded", verifiedServices.some((service) => combined.toLowerCase().includes(service.toLowerCase())), "At least one verified service supports the proposal"),
      result("location-grounded", !/jaipur|india|rajasthan/i.test(combined) || verifiedLocations.some((location) => combined.toLowerCase().includes(location.toLowerCase())), "Location claims are verified"),
      result("no-invented-price", !/[₹$€£]\s*\d|\b\d+(?:\.\d+)?\s*(?:rupees|inr|usd)\b/i.test(combined) || knownPrices.some((price) => combined.includes(String(price))), "No unverified pricing claim"),
      result("no-guarantee", !/guaranteed|best in|number\s*1|#1|instant results|100%/i.test(combined), "No unsupported guarantee or superiority claim"),
      result("no-keyword-stuffing", Math.max(0, ...Object.values(words(combined).reduce((counts, word) => ({ ...counts, [word]: (counts[word] ?? 0) + 1 }), {}))) <= 4, "No term repeats more than four times"),
      result("payload-fields", Object.keys(proposal.proposed).every((key) => ["title", "metaDescription", "canonical", "robots"].includes(key)), "Only V1 SEO fields are present"),
    ];
    return { passed: checks.every((check) => check.passed), checks, riskScore: checks.filter((check) => !check.passed).length * 10, proposalHash: digest(proposal.proposed), validatedAt: new Date().toISOString() };
  }
}

export class SeoPostPublishVerifier {
  verify({ approvedPayload, approvedPayloadHash, stagingDraft, productionBefore, productionAfter }) {
    const checks = [
      result("draft-exists", Boolean(stagingDraft?.id), "Staging draft exists"),
      result("draft-status", stagingDraft?.status === "draft", "WordPress status is draft"),
      result("title-match", stagingDraft?.title === approvedPayload.title, "Returned title matches approved payload"),
      result("meta-match", stagingDraft?.metaDescription === approvedPayload.metaDescription, "Returned meta description matches approved payload"),
      result("approved-hash", digest(approvedPayload) === approvedPayloadHash, "Published payload is the exact approved version"),
      result("ownership", stagingDraft?.managed === true && Boolean(stagingDraft?.experimentId), "Draft carries BusinessOS ownership markers"),
      result("production-unchanged", productionBefore.hash === productionAfter.hash, "Production fingerprint is unchanged"),
    ];
    return { passed: checks.every((check) => check.passed), checks, verifiedAt: new Date().toISOString() };
  }
}

export const payloadHash = digest;
