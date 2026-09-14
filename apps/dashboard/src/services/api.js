// Single place that talks to apps/server.mjs. Every response is JSON; the server answers
// `{ error }` with a 4xx for anything it refuses.
//
// Auth is a bearer token in localStorage under the same key the pre-SPA dashboard used
// ("businessos.session"), so a signed-in owner stays signed in across the rewrite.

const TOKEN_KEY = "businessos.session";

export const session = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (token) => { try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } },
};

async function request(path, { method = "GET", body } = {}) {
  const token = session.get();
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `Request failed (${response.status})`);
    error.status = response.status;
    // A rejected token is a dead token; drop it so the app shows sign-in rather than
    // looping on 401s with a credential that will never work again.
    if (response.status === 401) session.clear();
    throw error;
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),
  authStatus: () => request("/api/auth/status"),
  login: (input) => request("/api/auth/login", { method: "POST", body: input }),
  register: (input) => request("/api/auth/register", { method: "POST", body: input }),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  navigation: ({ includeHidden = true } = {}) => request(`/api/navigation?includeHidden=${includeHidden}`),
  state: () => request("/api/state"),
  updateProfile: (input) => request("/api/profile", { method: "PUT", body: input }),
  addBrain: (input) => request("/api/brain", { method: "POST", body: input }),
  aiChat: (input) => request("/api/ai/chat", { method: "POST", body: input }),
  agentPlans: () => request("/api/agent/plans"),
  proposeAgentPlan: (input) => request("/api/agent/plan", { method: "POST", body: input }),
  decideAgentPlan: (id, decision, comment) => request(`/api/agent/plans/${id}/decision`, { method: "POST", body: { decision, comment } }),

  // Plugin lifecycle (plan section 96). Uninstall always states the data decision
  // explicitly; the server rejects the call without it.
  apps: () => request("/api/apps"),
  install: (id) => request(`/api/apps/${id}/install`, { method: "POST" }),
  enable: (id) => request(`/api/apps/${id}/enable`, { method: "POST" }),
  disable: (id) => request(`/api/apps/${id}/disable`, { method: "POST" }),
  update: (id) => request(`/api/apps/${id}/update`, { method: "POST" }),
  uninstall: (id, { keepData }) => request(`/api/apps/${id}/uninstall`, { method: "POST", body: { keepData } }),
  catalogWorkbook: () => request("/api/catalog/workbook"),
  catalogWorkbookOperation: (operation) => request("/api/catalog/workbook", { method: "POST", body: operation }),
  catalogWorkbookExport: () => request("/api/catalog/workbook/export"),
  catalogWorkbookImport: ({ tables = [], files = [] } = {}) => request("/api/catalog/workbook/import", { method: "POST", body: { tables, files } }),
  pricingStage: () => request("/api/pricing/stage", { method: "POST", body: {} }),
  controlPlaneMarketplace: () => request("/api/marketplace/control-plane"),
  installRemote: (id) => request(`/api/marketplace/control-plane/${id}/install`, { method: "POST" }),
  marketplacePackages: () => request("/api/marketplace/packages"),
  installedPackages: () => request("/api/marketplace/packages/installed"),
  installPackage: (type, id) => request(`/api/marketplace/packages/${type}/${id}/install`, { method: "POST" }),
  setPackageState: (type, id, state) => request(`/api/marketplace/packages/${type}/${id}/${state}`, { method: "POST" }),
  updateRemote: (id) => request(`/api/marketplace/control-plane/${id}/update`, { method: "POST" }),
  rollbackRemote: (id, version) => request(`/api/marketplace/control-plane/${id}/rollback`, { method: "POST", body: { version } }),

  // BusinessOS Guide. Actions returned by the server are proposals; sending one back to
  // /api/guide/action is what makes it happen, and core validates it again there.
  guideContext: (route) => request(`/api/guide/context?route=${encodeURIComponent(route)}`),
  guideSuggestions: () => request("/api/guide/suggestions"),
  guideMessage: ({ text, route }) => request("/api/guide/message", { method: "POST", body: { text, route } }),
  guideAction: (action) => request("/api/guide/action", { method: "POST", body: action }),
  // Only labels are sent. `extractElements` never collects field values.
  pointaiMatch: ({ goal, elements, host, stepContext }) =>
    request("/api/guide/pointai/match", { method: "POST", body: { goal, elements, host, stepContext } }),
  setupPlaybooks: () => request("/api/guide/setup-playbooks"),
  setupPlaybook: (id) => request(`/api/guide/setup-playbooks/${encodeURIComponent(id)}`),
  externalGuideStart: (input) => request("/api/guide/external/start", { method: "POST", body: input }),
  externalGuideObserve: (id, input) => request(`/api/guide/external/${id}/observe`, { method: "POST", body: input }),

  workflows: () => request("/api/workflows"),
  decide: (id, decision, comment) => request(`/api/approvals/${id}`, { method: "POST", body: { decision, comment } }),

  // SEO vertical (plan section 100). Each call is refused by the server unless the step
  // before it has produced real evidence.
  seoAudit: (input) => request("/api/seo/audit", { method: "POST", body: input ?? {} }),
  searchConsoleImport: (snapshot) => request("/api/search-console/import", { method: "POST", body: snapshot }),
  seoDiscover: () => request("/api/seo/opportunities/discover", { method: "POST", body: {} }),
  seoPropose: (opportunityId) => request("/api/seo/proposals", { method: "POST", body: { opportunityId } }),
  seoPublishStaging: (experimentId) => request("/api/seo/publish-staging", { method: "POST", body: { experimentId } }),

  tasks: (status) => request(`/api/tasks${status ? `?status=${status}` : ""}`),
  createTask: (input) => request("/api/tasks", { method: "POST", body: input }),
  setTaskStatus: (id, status) => request(`/api/tasks/${id}`, { method: "POST", body: { status } }),
  sandboxRun: (input) => request("/api/sandbox/run", { method: "POST", body: input }),
};

export { request };
