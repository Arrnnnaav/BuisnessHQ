import assert from "node:assert/strict";
import { WebsiteAuditor } from "../core/runtime/index.mjs";

const pages = new Map([
  ["https://example.com/", `<!doctype html><html><head><title>Home</title></head><body><h1>Example</h1><a href="/services">Services</a><img src="x.jpg"></body></html>`],
  ["https://example.com/services", `<!doctype html><html><head><title>Printing Services in Jaipur | Example Company</title><meta name="description" content="Professional printing services for Jaipur companies, including brochures, catalogs and visiting cards with reliable local support."><link rel="canonical" href="https://example.com/services"></head><body><h1>Printing services in Jaipur</h1><p>${"Useful verified service information. ".repeat(30)}</p><script type="application/ld+json">{"@type":"LocalBusiness"}</script></body></html>`],
]);
const auditor = new WebsiteAuditor({ lookupImpl: async () => [{ address: "93.184.216.34" }], fetchImpl: async (url) => new Response(pages.get(url), { status: pages.has(url) ? 200 : 404, headers: { "content-type": "text/html" } }) });
const result = await auditor.auditSite("https://example.com", { maxPages: 5 });
assert.equal(result.pagesAudited, 2);
assert.equal(result.externalEffects, false);
assert.ok(result.findings.some((finding) => finding.code === "missing-description"));
await assert.rejects(() => new WebsiteAuditor({ lookupImpl: async () => [{ address: "127.0.0.1" }] }).validateUrl("http://internal.example"), /Private/);
console.log("SEO auditor self-test passed");
