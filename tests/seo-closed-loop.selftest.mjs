import assert from "node:assert/strict";
import { SearchConsoleOAuth, SeoExperimentService, SeoOpportunityEngine, SeoPostPublishVerifier, SeoPrePublishValidator, WordPressStagingConnector, fingerprintPage, payloadHash } from "../core/runtime/index.mjs";

const engine = new SeoOpportunityEngine();
const page = { id: 42, url: "https://example.com/brochures/", title: "ABizCreator Printing", metaDescription: "Existing description", content: "Brochure printing", canonical: "https://example.com/brochures/", snapshotRef: "snap-1" };
const [opportunity] = engine.discover({ tenantId: "tenant-1", rows: [{ query: "brochure printing jaipur", page: page.url, clicks: 31, impressions: 4821, ctr: 0.0064, position: 8.7 }], pages: [page], companyBrainRefs: [{ id: "fact-service", value: "brochure printing" }, { id: "fact-location", value: "Jaipur" }], searchConsoleSnapshotRef: "gsc-1" });
assert.equal(opportunity.type, "low_ctr"); assert.equal(opportunity.evidence.impressions, 4821); assert.ok(Object.isFrozen(opportunity.evidence));

const proposal = { version: 1, targetUrl: page.url, current: { title: page.title, metaDescription: page.metaDescription }, proposed: { title: "Brochure Printing in Jaipur | ABizCreator", metaDescription: "Professional brochure printing in Jaipur for businesses, events and marketing campaigns. Explore verified printing options and request a quote from ABizCreator." } };
const validation = new SeoPrePublishValidator().validate({ proposal, currentPage: page, verifiedServices: ["brochure printing"], verifiedLocations: ["Jaipur"] });
assert.equal(validation.passed, true);
const experiments = new SeoExperimentService(); let experiment = experiments.create({ tenantId: "tenant-1", opportunity, proposal, validation });
experiment = experiments.transition(experiment, "AWAITING_APPROVAL"); experiment = experiments.transition(experiment, "APPROVED", { approvedVersion: 1, approvedPayloadHash: payloadHash(proposal.proposed) }); experiment = experiments.transition(experiment, "STAGING_WRITE_STARTED"); experiment = experiments.transition(experiment, "VERIFICATION_PENDING");
const productionBefore = fingerprintPage(page); const productionAfter = fingerprintPage(page); productionAfter.hash = productionBefore.hash;
const verification = new SeoPostPublishVerifier().verify({ approvedPayload: proposal.proposed, approvedPayloadHash: experiment.approvedPayloadHash, stagingDraft: { id: 99, status: "draft", title: proposal.proposed.title, metaDescription: proposal.proposed.metaDescription, managed: true, experimentId: experiment.id }, productionBefore, productionAfter });
assert.equal(verification.passed, true); experiment = experiments.transition(experiment, "ACTIVE", { verification }); assert.equal(experiment.status, "ACTIVE");

const calls = []; const connector = new WordPressStagingConnector({ siteUrl: "https://staging.example.com", username: "connector", applicationPassword: "secret", fetchImpl: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ id: 99, status: "draft" }), { status: 201 }); } });
await connector.createDraft({ tenantId: "tenant-1", experimentId: experiment.id, sourcePageId: 42, payload: proposal.proposed });
assert.equal(JSON.parse(calls[0].options.body).status, "draft"); assert.match(calls[0].options.headers.authorization, /^Basic /);
const oauth = new SearchConsoleOAuth({ fetchImpl: async () => new Response(JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_in: 3600, scope: "https://www.googleapis.com/auth/webmasters.readonly" }), { status: 200 }) });
const authUrl = new URL(oauth.begin({ ownerId: "tenant-1", clientId: "client", clientSecret: "secret", redirectUri: "http://localhost/callback", siteUrl: "https://example.com/" }));
assert.equal(authUrl.searchParams.get("scope"), "https://www.googleapis.com/auth/webmasters.readonly");
const exchanged = await oauth.exchange({ state: authUrl.searchParams.get("state"), code: "code" }); assert.equal(exchanged.config.refreshToken, "refresh");
console.log("SEO closed-loop self-test passed");
