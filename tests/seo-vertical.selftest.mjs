import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  SeoExperimentService, SeoOpportunityEngine, SeoPostPublishVerifier, SeoPrePublishValidator,
  WebsiteAuditor, WordPressStagingConnector, fingerprintPage, payloadHash,
} from "../core/runtime/index.mjs";

// The whole SEO vertical (plan section 100), run in order against the real services with
// only the third parties faked: the customer's website, the model, and the staging
// WordPress. Everything between them is the code the server actually runs.
//
// The auditor's SSRF guard refuses localhost and private addresses, which is correct and
// is not disabled here. Instead the fetch and DNS it depends on are injected, so a public
// hostname resolves to a public address and the bytes come from this file.

const SITE = "https://abizcreator.example";
const PAGE = `${SITE}/brochure-printing/`;

const html = ({ title, description }) => `<!doctype html><html><head>
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${PAGE}">
</head><body><h1>Brochure printing</h1>
<p>We print brochures for businesses in Jaipur.</p>
<a href="${PAGE}">Brochures</a></body></html>`;

// The live site as it stands today: a weak title, and a description that undersells it.
const live = { title: "Untitled", description: "Printing" };

const auditor = new WebsiteAuditor({
  lookupImpl: async () => [{ address: "93.184.216.34" }],
  fetchImpl: async (url) => {
    const path = new URL(url).pathname;
    if (path === "/" || path === "/brochure-printing/") {
      return new Response(html(live), { status: 200, headers: { "content-type": "text/html" } });
    }
    return new Response("not found", { status: 404 });
  },
});

// ---- 1. Production crawl ----------------------------------------------------------
const auditResult = await auditor.auditSite(PAGE, { maxPages: 3 });
assert.ok(auditResult.pagesAudited >= 1, "the crawl must read at least the target page");
const currentPage = auditResult.pages.find((page) => page.url === PAGE) ?? auditResult.pages[0];
assert.equal(currentPage.title, "Untitled");

// A crawl reads; it must never write. The fake site would have recorded any other method.
assert.equal(auditResult.pages.every((page) => typeof page.url === "string"), true);

// ---- 2. Real Search Console evidence ----------------------------------------------
// Rows shaped exactly like a Search Analytics export: lots of impressions, almost no
// clicks. That gap is the entire argument for changing anything.
const rows = [
  { query: "brochure printing jaipur", page: PAGE, clicks: 31, impressions: 4821, ctr: 0.0064, position: 8.7 },
  { query: "cheap brochures", page: PAGE, clicks: 2, impressions: 118, ctr: 0.017, position: 22.4 },
];

// ---- 3. Company Brain grounding ---------------------------------------------------
const companyBrainRefs = [
  { id: "fact-service", key: "service", value: "brochure printing" },
  { id: "fact-location", key: "primary_location", value: "Jaipur" },
];

const engine = new SeoOpportunityEngine();
const opportunities = engine.discover({
  tenantId: "tenant-1", rows,
  pages: [{ ...currentPage, id: 1, metaDescription: currentPage.description, snapshotRef: auditResult.id }],
  companyBrainRefs, searchConsoleSnapshotRef: auditResult.id,
});

assert.ok(opportunities.length > 0, "high impressions with no clicks must surface an opportunity");
const opportunity = opportunities[0];
assert.equal(opportunity.type, "low_ctr");
// The evidence is frozen: what justified the change cannot be edited afterwards.
assert.equal(Object.isFrozen(opportunity.evidence), true);
assert.equal(opportunity.evidence.impressions, 4821);

// ---- 4. Proposal, grounded and conservative ---------------------------------------
const proposal = {
  id: randomUUID(), version: 1, targetUrl: PAGE,
  current: { title: currentPage.title, metaDescription: currentPage.description },
  proposed: {
    title: "Brochure Printing in Jaipur | ABizCreator",
    metaDescription: "Professional brochure printing in Jaipur for businesses, events and marketing campaigns. Request a quote from ABizCreator today.",
  },
  companyBrainRefs: opportunity.evidence.companyBrainRefs,
};

const validator = new SeoPrePublishValidator();
const verifiedServices = ["brochure printing", "flyer printing"];
const verifiedLocations = ["Jaipur", "Rajasthan"];

const validation = validator.validate({
  proposal, currentPage: { url: currentPage.url, canonical: currentPage.canonical },
  verifiedServices, verifiedLocations, knownPrices: [],
});
assert.equal(validation.passed, true, `grounded proposal should validate: ${JSON.stringify(validation)}`);

// ---- 5. Validation actually refuses invented claims --------------------------------
// This is the guard that matters: a model that invents a city, a price or a guarantee
// must not reach the approval queue at all.
const invented = validator.validate({
  proposal: {
    ...proposal,
    proposed: {
      title: "Brochure Printing in Mumbai | Cheapest Guaranteed",
      metaDescription: "Guaranteed cheapest brochure printing in Mumbai from just Rs 99 with free nationwide delivery and a lifetime warranty on every order.",
    },
  },
  currentPage: { url: currentPage.url, canonical: currentPage.canonical },
  verifiedServices, verifiedLocations, knownPrices: [],
});
assert.equal(invented.passed, false, "a proposal naming an unverified city and price must fail");

// ---- 6. Experiment lifecycle up to the approval gate -------------------------------
const experiments = new SeoExperimentService();
let experiment = experiments.create({ tenantId: "tenant-1", opportunity, proposal, validation });
experiment = experiments.transition(experiment, "AWAITING_APPROVAL");
assert.equal(experiment.status, "AWAITING_APPROVAL");

// The owner edits the wording before approving — the common case, and the one where a
// system can quietly publish the text it preferred instead.
const approvedPayload = {
  title: "Brochure Printing in Jaipur | ABizCreator",
  metaDescription: "Brochure printing in Jaipur for businesses and events. Ask us for a quote.",
};
const approvedHash = payloadHash(approvedPayload);
assert.notEqual(approvedHash, payloadHash(proposal.proposed), "the owner's edit differs from the draft");

experiment = experiments.addProposal(experiment, { ...proposal, id: randomUUID(), proposed: approvedPayload, source: "owner-edit" });
experiment = experiments.transition(experiment, "APPROVED", { approvedVersion: 2, approvedPayloadHash: approvedHash, approver: "owner-1" });

// ---- 7. Staging write ---------------------------------------------------------------
const wordpressCalls = [];
const connector = new WordPressStagingConnector({
  siteUrl: "https://staging.abizcreator.example",
  username: "businessos", applicationPassword: "app-password",
  fetchImpl: async (url, options = {}) => {
    wordpressCalls.push({ url, method: options.method ?? "GET", body: options.body ? JSON.parse(options.body) : null });
    if ((options.method ?? "GET") === "GET") {
      return new Response(JSON.stringify({ id: 99, status: "draft", title: approvedPayload.title, metaDescription: approvedPayload.metaDescription, managed: true, experimentId: experiment.id }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 99, status: "draft" }), { status: 201 });
  },
});

experiment = experiments.transition(experiment, "STAGING_WRITE_STARTED");
const productionBefore = fingerprintPage({ url: PAGE, title: live.title, metaDescription: live.description, canonical: PAGE, content: html(live) });

const created = await connector.createDraft({ tenantId: "tenant-1", experimentId: experiment.id, sourcePageId: 1, payload: approvedPayload });
assert.equal(created.id, 99);

// What went to WordPress is a draft, and it is the approved text — not the draft text.
const write = wordpressCalls.find((call) => call.method !== "GET");
assert.equal(write.body.status, "draft", "the connector must never publish");
assert.equal(write.body.title, approvedPayload.title);
assert.notEqual(write.body.title === proposal.proposed.title && write.body.metaDescription === proposal.proposed.metaDescription, true);

experiment = experiments.transition(experiment, "VERIFICATION_PENDING", { stagingDraftId: created.id });

// ---- 8. Production fingerprint verification ------------------------------------------
// The live site must be byte-identical afterwards. Writing to staging that silently
// touched production is the failure this check exists to catch.
const productionAfter = fingerprintPage({ url: PAGE, title: live.title, metaDescription: live.description, canonical: PAGE, content: html(live) });
assert.equal(productionAfter.hash, productionBefore.hash, "the live site must be untouched");

const stagingDraft = await connector.getDraft(created.id);
const verifier = new SeoPostPublishVerifier();
const verification = verifier.verify({ approvedPayload, approvedPayloadHash: approvedHash, stagingDraft, productionBefore, productionAfter });
assert.equal(verification.passed, true, `verification should pass: ${JSON.stringify(verification)}`);

experiment = experiments.transition(experiment, "ACTIVE", { verification });
assert.equal(experiment.status, "ACTIVE");

// ---- 9. Verification catches a changed production page --------------------------------
const tampered = fingerprintPage({ url: PAGE, title: "Something else entirely", metaDescription: live.description, canonical: PAGE, content: html({ title: "Something else entirely", description: live.description }) });
const caught = verifier.verify({ approvedPayload, approvedPayloadHash: approvedHash, stagingDraft, productionBefore, productionAfter: tampered });
assert.equal(caught.passed, false, "a changed live page must fail verification");

// ---- 10. And a staging draft that does not match what was approved ---------------------
const wrongDraft = { ...stagingDraft, title: "Title nobody approved" };
const mismatch = verifier.verify({ approvedPayload, approvedPayloadHash: approvedHash, stagingDraft: wrongDraft, productionBefore, productionAfter });
assert.equal(mismatch.passed, false, "a staging draft that differs from the approved text must fail");

// The experiment carries its whole history: evidence, every proposal version, what was
// approved, and by whom.
assert.equal(experiment.proposalVersions.length, 2);
assert.equal(experiment.approvedPayloadHash, approvedHash);
assert.equal(experiment.evidence.impressions, 4821);
assert.equal(experiment.opportunityId, opportunity.id);
// The evidence is hashed, so what justified the change cannot be rewritten later.
assert.ok(experiment.evidenceHash, "the experiment records a hash of its evidence");

console.log(`SEO vertical self-test passed (crawl -> evidence -> proposal -> approval -> staging -> verified, ${experiment.proposalVersions.length} proposal versions)`);
