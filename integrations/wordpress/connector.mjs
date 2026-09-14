const basic = (username, password) => `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
export class WordPressStagingConnector {
  constructor({ siteUrl, username, applicationPassword, fetchImpl = fetch } = {}) { this.siteUrl = String(siteUrl ?? "").replace(/\/$/, ""); this.username = username; this.applicationPassword = applicationPassword; this.fetch = fetchImpl; }
  async request(path, options = {}) { if (!this.siteUrl.startsWith("https://")) throw new Error("WordPress staging connector requires HTTPS"); const response = await this.fetch(`${this.siteUrl}/wp-json/businessos/v1${path}`, { ...options, headers: { "content-type": "application/json", authorization: basic(this.username, this.applicationPassword), ...(options.headers ?? {}) }, signal: AbortSignal.timeout(20_000) }); const data = await response.json(); if (!response.ok) throw new Error(`WordPress connector failed: ${response.status} ${data.message ?? data.error ?? "Unknown error"}`); return data; }
  health() { return this.request("/health"); }
  snapshot(pageId) { return this.request(`/pages/${encodeURIComponent(pageId)}/snapshot`); }
  async createDraft({ tenantId, experimentId, sourcePageId, payload }) { return this.normalize(await this.request("/drafts", { method: "POST", body: JSON.stringify({ status: "draft", tenant_id: tenantId, experiment_id: experimentId, source_page_id: sourcePageId, title: payload.title, meta_description: payload.metaDescription }) })); }
  async getDraft(id) { return this.normalize(await this.request(`/drafts/${encodeURIComponent(id)}`)); }
  updateOwnedDraft(id, payload) { return this.request(`/drafts/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "draft", title: payload.title, meta_description: payload.metaDescription }) }); }
  async rollbackOwnedDraft(id, snapshot) { return this.normalize(await this.request("/rollback", { method: "POST", body: JSON.stringify({ draft_id: id, snapshot: { title: snapshot.title, meta_description: snapshot.metaDescription } }) })); }
  normalize(data) { return { ...data, metaDescription: data.metaDescription ?? data.meta_description ?? "", experimentId: data.experimentId ?? data.experiment_id ?? "", tenantId: data.tenantId ?? data.tenant_id ?? "", requestId: data.requestId ?? data.request_id ?? "" }; }
}
