const baseUrl = process.env.BUSINESSOS_URL ?? "http://127.0.0.1:4173";
const request = async (path, { token, method = "GET", body } = {}) => { const response = await fetch(`${baseUrl}${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(`${path}: ${data.error ?? response.status}`); return data; };
const account = await request("/api/auth/login", { method: "POST", body: { email: "demo.owner@businessos.local", password: "DemoBusinessOS!2026" } }); const token = account.session.token;
const audit = await request("/api/seo/audit", { token, method: "POST", body: { url: "https://example.com/", maxPages: 1 } });
const snapshot = await request("/api/search-console/import", { token, method: "POST", body: { siteUrl: "https://example.com/", startDate: "2026-08-01", endDate: "2026-08-28", rows: [{ query: "brochure printing jaipur", page: "https://example.com/", clicks: 31, impressions: 4821, ctr: 0.0064, position: 8.7 }] } });
const opportunities = await request("/api/seo/opportunities/discover", { token, method: "POST", body: {} });
if (opportunities[0]?.type !== "low_ctr") throw new Error("Expected a low_ctr opportunity");
console.log(JSON.stringify({ crawlId: audit.id, searchConsoleSnapshotId: snapshot.id, opportunityId: opportunities[0].id, type: opportunities[0].type, evidenceHash: opportunities[0].evidenceHash, externalEffects: false }, null, 2));
