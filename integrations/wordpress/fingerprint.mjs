import { createHash } from "node:crypto";

const normalized = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
export const fingerprintPage = (page) => { const snapshot = { productionUrl: page.url, productionPageId: page.id ?? null, productionContentSnapshot: normalized(page.content), productionTitle: normalized(page.title), productionMeta: normalized(page.metaDescription), canonical: page.canonical ?? null, capturedAt: new Date().toISOString() }; return { ...snapshot, hash: createHash("sha256").update(JSON.stringify({ ...snapshot, capturedAt: undefined })).digest("hex") }; };
