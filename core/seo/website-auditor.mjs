import { isIP } from "node:net";
import { lookup as lookupCallback } from "node:dns";
import { promisify } from "node:util";

const lookup = promisify(lookupCallback);
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const match = (html, pattern) => html.match(pattern)?.[1]?.trim() ?? "";
const privateIp = (address) => /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address) || address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:");

export class WebsiteAuditor {
  constructor({ fetchImpl = fetch, lookupImpl = lookup } = {}) { this.fetch = fetchImpl; this.lookupImpl = lookupImpl; }
  async validateUrl(value) { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol)) throw new Error("Website URL must use HTTP or HTTPS"); if (["localhost", "0.0.0.0"].includes(url.hostname)) throw new Error("Private/local website targets are not allowed"); const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await this.lookupImpl(url.hostname, { all: true }); if (!addresses.length || addresses.some(({ address }) => privateIp(address))) throw new Error("Private/local website targets are not allowed"); return url; }
  // Network failures surface to a business owner, so they are translated. "getaddrinfo
  // ENOTFOUND" is not a sentence anyone should have to read to learn their address is
  // wrong.
  #explain(error, url) {
    const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();
    const code = error?.cause?.code ?? error?.code ?? "";
    if (code === "ENOTFOUND" || /ENOTFOUND/.test(error?.message ?? "")) return new Error(`We could not find a website at ${host}. Check the address in your Business Profile.`);
    if (code === "ECONNREFUSED") return new Error(`${host} refused the connection. The site may be down.`);
    if (code === "CERT_HAS_EXPIRED" || /certificate/i.test(error?.message ?? "")) return new Error(`${host} has a security certificate problem, so we stopped rather than trust it.`);
    if (error?.name === "TimeoutError" || /timeout/i.test(error?.message ?? "")) return new Error(`${host} took too long to respond.`);
    return error;
  }

  async fetchPage(url) {
    try {
      await this.validateUrl(url);
      return await this.fetchPageRaw(url);
    } catch (error) { throw this.#explain(error, url); }
  }

  async fetchPageRaw(url) { const response = await this.fetch(url, { redirect: "manual", headers: { "user-agent": "BusinessOS-SEO-Auditor/1.0" }, signal: AbortSignal.timeout(15000) }); if (response.status >= 300 && response.status < 400) { const location = response.headers.get("location"); if (!location) throw new Error(`Redirect ${response.status} has no location`); return this.fetchPage(new URL(location, url).href); } if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`); const contentType = response.headers.get("content-type") ?? ""; if (!contentType.includes("text/html")) throw new Error("Website did not return HTML"); const html = await response.text(); if (html.length > 5_000_000) throw new Error("Website page is too large to audit safely"); return { finalUrl: response.url || url, html, status: response.status };
  }
  analyze(url, html) {
    const title = match(html, /<title[^>]*>([\s\S]*?)<\/title>/i); const description = match(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || match(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i); const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((item) => text(item[1])); const canonical = match(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i); const hasLocalBusinessSchema = /["']@type["']\s*:\s*["'](?:LocalBusiness|ProfessionalService|Store)["']/i.test(html); const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((item) => item[0]); const missingAlt = images.filter((image) => !/\balt=["'][^"']+["']/i.test(image)).length; const wordCount = text(html).split(/\s+/).filter(Boolean).length; const findings = [];
    if (!title) findings.push({ severity: "high", code: "missing-title", message: "Page has no title tag" }); else if (title.length < 25 || title.length > 65) findings.push({ severity: "medium", code: "title-length", message: `Title length is ${title.length}; target roughly 25–65 characters` });
    if (!description) findings.push({ severity: "high", code: "missing-description", message: "Page has no meta description" }); else if (description.length < 70 || description.length > 170) findings.push({ severity: "medium", code: "description-length", message: `Meta description length is ${description.length}; target roughly 70–170 characters` });
    if (h1s.length !== 1) findings.push({ severity: "medium", code: "h1-count", message: `Page has ${h1s.length} H1 headings; target one descriptive H1` });
    if (!canonical) findings.push({ severity: "low", code: "missing-canonical", message: "Canonical URL is missing" });
    if (!hasLocalBusinessSchema) findings.push({ severity: "medium", code: "missing-local-schema", message: "LocalBusiness schema was not detected" });
    if (missingAlt) findings.push({ severity: "medium", code: "missing-image-alt", message: `${missingAlt} image(s) lack descriptive alt text` });
    if (wordCount < 250) findings.push({ severity: "medium", code: "thin-content", message: `Page has approximately ${wordCount} words` });
    return { url, title, description, h1s, canonical, hasLocalBusinessSchema, imageCount: images.length, missingAlt, wordCount, findings, score: Math.max(0, 100 - findings.reduce((total, finding) => total + ({ high: 20, medium: 10, low: 5 }[finding.severity]), 0)) };
  }
  async auditSite(startUrl, { maxPages = 10 } = {}) { const start = await this.validateUrl(startUrl).catch((error) => { throw this.#explain(error, startUrl); }); const origin = start.origin; const queue = [start.href]; const visited = new Set(); const pages = []; while (queue.length && pages.length < Math.min(Math.max(maxPages, 1), 25)) { const current = queue.shift(); if (visited.has(current)) continue; visited.add(current); try { const { finalUrl, html } = await this.fetchPage(current); pages.push(this.analyze(finalUrl, html)); for (const item of html.matchAll(/<a\b[^>]+href=["']([^"'#]+)["']/gi)) { const link = new URL(item[1], finalUrl); link.hash = ""; if (link.origin === origin && !visited.has(link.href) && !queue.includes(link.href)) queue.push(link.href); } } catch (error) { pages.push({ url: current, score: 0, findings: [{ severity: "high", code: "fetch-failed", message: error.message }] }); } } const totalFindings = pages.flatMap((page) => page.findings); return { id: crypto.randomUUID(), startUrl: start.href, pages, pagesAudited: pages.length, averageScore: pages.length ? Math.round(pages.reduce((total, page) => total + page.score, 0) / pages.length) : 0, findings: totalFindings, externalEffects: false, createdAt: new Date().toISOString() }; }
}
