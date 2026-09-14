import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AppStore } from "../core/app-store.mjs";
import { AgentPlanStore, AiRuntime, AuditLog, AuthService, CapabilityRegistry, CompanyBrainRegistry, ControlPlaneMarketplace, createAgentPlan, createXlsx, CredentialVault, ElementMatcher, EventBus, ExternalGuideSession, FIRST_PARTY_PACKAGES, FirstPartyPackageRegistry, GuideService, listSetupPlaybooks, parseXlsx, PlaybookCache, Marketplace, ModelRouter, PluginLifecycle, TaskStore, parseCatalog, payloadHash, PluginManager, PolicyEngine, PricingAgentService, SandboxConnector, SearchConsoleClient, SearchConsoleOAuth, SemanticIndexRegistry, SeoExperimentService, SeoOpportunityEngine, SeoPostPublishVerifier, SeoPrePublishValidator, setupPlaybook, TenantStore, WebsiteAuditor, WorkflowEngine, WordPressStagingConnector, fingerprintPage } from "../core/runtime/index.mjs";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
// Tests and staging can point at an isolated workspace so validation never mutates a
// developer's real tenant, credentials, approvals, or audit history.
const dataRoot = resolve(process.env.BUSINESSOS_DATA_ROOT || resolve(appRoot, "data"));
const store = new AppStore(resolve(dataRoot, "runtime-state.json"));
const audit = new AuditLog({ stateFile: resolve(dataRoot, "audit.jsonl") }); const registry = new CapabilityRegistry(); const events = new EventBus();
const sandbox = new SandboxConnector({ audit });
const pricingAgent = new PricingAgentService({ projectRoot: appRoot, dataRoot });
const websiteAuditor = new WebsiteAuditor();
const opportunityEngine = new SeoOpportunityEngine(); const prePublishValidator = new SeoPrePublishValidator(); const postPublishVerifier = new SeoPostPublishVerifier(); const seoExperiments = new SeoExperimentService();
const searchConsoleOAuth = new SearchConsoleOAuth();
const ai = new AiRuntime();
const semantic = new SemanticIndexRegistry({ dataRoot: resolve(dataRoot, "tenants"), embed: (input) => ai.embed(input) });
const auth = new AuthService({ stateFile: resolve(dataRoot, "auth.json") });
const tenants = new TenantStore({ stateFile: resolve(dataRoot, "tenants.json") });
const vault = new CredentialVault({ stateFile: resolve(dataRoot, "vault.json"), keyFile: resolve(dataRoot, ".vault-key") });
const marketplace = new Marketplace({ stateFile: resolve(dataRoot, "marketplace.json"), audit, capabilityRegistry: registry });
const firstPartyPackages = new FirstPartyPackageRegistry({ stateFile: resolve(dataRoot, "control-plane/packages.json") });
const controlPlaneMarketplace = new ControlPlaneMarketplace({ registryFile: resolve(dataRoot, "control-plane/registry.json"), publicKeyFile: resolve(dataRoot, "control-plane/signing-keys.json"), installRoot: resolve(dataRoot, "remote-plugins") });
const brains = new CompanyBrainRegistry({ dataRoot: resolve(dataRoot, "tenants") });
const workflows = new WorkflowEngine({ policyEngine: new PolicyEngine(), eventBus: events, audit, stateFile: resolve(dataRoot, "workflows.json") });
const agentPlans = new AgentPlanStore({ stateFile: resolve(dataRoot, "agent-plans.json") });
const plugins = new PluginManager({ root: resolve(appRoot, "plugins"), audit, eventBus: events });
// Icons declared as web paths are only usable if the file actually ships with the
// dashboard; otherwise navigation falls back to a glyph rather than emitting a 404.
const dashboardAssets = [resolve(appRoot, "apps/dashboard/dist"), resolve(appRoot, "apps/dashboard/public")];
const iconExists = (webPath) => dashboardAssets.some((root) => { const file = resolve(root, `.${webPath}`); return file.startsWith(root) && existsSync(file); });
const lifecycle = new PluginLifecycle({ stateFile: resolve(dataRoot, "installations.json"), pluginManager: plugins, audit, eventBus: events, capabilityRegistry: registry, iconExists });
await store.load(); await Promise.all([auth.load(), tenants.load(), vault.load(), workflows.load(), agentPlans.load(), marketplace.load(), controlPlaneMarketplace.load(), firstPartyPackages.load()]);
for (const manifest of FIRST_PARTY_PACKAGES) if (!firstPartyPackages.list({ includeDisabled: true }).some((item) => item.type === manifest.type && item.id === manifest.id && item.version === manifest.version)) firstPartyPackages.publish(manifest);
await firstPartyPackages.save();
const latestFirstPartyPackages = () => {
  const latest = new Map();
  for (const item of firstPartyPackages.list()) {
    const key = `${item.type}:${item.id}`;
    const current = latest.get(key);
    if (!current || item.version.localeCompare(current.version, undefined, { numeric: true }) > 0) latest.set(key, item);
  }
  return [...latest.values()];
};
await plugins.discover(); await lifecycle.load();
// Discovering a manifest is not the same as a company having the app. Installation is
// per tenant and persisted; a first-time owner gets the starter set (plan section 84),
// not all seventeen bundled apps.
const workspaceFor = async (user) => { await lifecycle.ensureDefaults(user.id); return lifecycle; };
const tasks = new TaskStore({ stateFile: resolve(dataRoot, "tasks.json") });
await tasks.load();
// The Guide is core (ruling R5): available on a workspace with nothing installed, which
// is exactly when an owner needs to be told what to install.
const guide = new GuideService({ lifecycle, tasks, ai, audit, pluginManager: plugins });
// Internal PointAI. Element values never reach here: the browser does not collect them and
// the matcher strips anything that arrives anyway (guide spec section 23).
const pointai = new ElementMatcher({ ai, audit });
const externalGuide = new ExternalGuideSession({ matcher: pointai, audit });
const playbooks = new PlaybookCache({ stateFile: resolve(dataRoot, "playbooks.json") });
await playbooks.load();

const json = (res, data, status = 200) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(data)); };
const body = async (req) => { let data = ""; for await (const chunk of req) { data += chunk; if (data.length > 2_000_000) throw new Error("Request body is too large"); } try { return data ? JSON.parse(data) : {}; } catch { throw new Error("Request body must be valid JSON"); } };
const staticTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".map": "application/json" };
// Serve the built SPA when it exists, otherwise the pre-SPA dashboard, so a checkout
// that has not run `pnpm build:dashboard` still boots (spec R4).
const spaRoot = resolve(appRoot, "apps/dashboard/dist");
const legacyRoot = resolve(appRoot, "apps/dashboard");
const spaBuilt = existsSync(resolve(spaRoot, "index.html"));
const webRoot = spaBuilt ? spaRoot : legacyRoot;
// Phase 3 (plan section 97): the owner-facing Marketplace is curated. Registering a raw
// GitHub repository is developer tooling and is off unless explicitly enabled, so a
// business owner is never asked to reason about repositories, commits or adapters.
const developerMode = process.env.BUSINESSOS_DEVELOPER_MODE === "1";
const bearer = (request) => request.headers.authorization?.replace(/^Bearer\s+/i, "");
const knowledgeDocument = (record) => ({ id: `brain:${record.id}`, type: "knowledge", sourceId: record.id, text: `${record.type}: ${record.key}. ${record.value}`, metadata: { status: record.status, confidence: record.confidence, tags: record.tags } });
const catalogDocument = (item) => ({ id: `catalog:${item.id}`, type: "catalog", sourceId: item.id, text: `${item.name}. ${item.description}. Category ${item.category}. Price ${item.price ?? "not verified"} ${item.currency}. Unit ${item.unit}.`, metadata: { sku: item.sku, active: item.active } });
const safeIndex = async (ownerId, documents) => { try { return await (await semantic.get(ownerId)).upsert(documents); } catch (error) { audit.record({ action: "semantic.index-deferred", ownerId, reason: error.message }); return []; } };
const parseJsonObject = (value) => { const match = String(value ?? "").match(/\{[\s\S]*\}/); if (!match) throw new Error("SEO agent did not return structured JSON"); return JSON.parse(match[0]); };
const publicSnapshot = async (url) => { const { finalUrl, html } = await websiteAuditor.fetchPage(url); const analyzed = websiteAuditor.analyze(finalUrl, html); return fingerprintPage({ url: finalUrl, title: analyzed.title, metaDescription: analyzed.description, canonical: analyzed.canonical, content: html }); };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/health") return json(res, { ok: true, developerMode, plugins: plugins.list().length, timestamp: new Date().toISOString() });
    if (url.pathname === "/api/auth/status") {
      const owner = auth.users?.values?.().next?.().value;
      const email = owner?.email ?? "";
      const ownerHint = email ? `${email.slice(0, 2)}***${email.includes("@") ? email.slice(email.indexOf("@")) : ""}` : null;
      return json(res, { initialized: auth.hasUsers(), ownerHint });
    }
    if (url.pathname === "/api/auth/register" && req.method === "POST") return json(res, await auth.register(await body(req)), 201);
    if (url.pathname === "/api/auth/login" && req.method === "POST") return json(res, await auth.login(await body(req)));
    if (url.pathname === "/api/search-console/oauth/callback" && req.method === "GET") { const exchanged = await searchConsoleOAuth.exchange({ state: url.searchParams.get("state"), code: url.searchParams.get("code") }); await vault.set(exchanged.ownerId, "search_console", JSON.stringify(exchanged.config)); audit.record({ action: "search-console.oauth-connected", ownerId: exchanged.ownerId, siteUrl: exchanged.config.siteUrl, scope: exchanged.config.scope }); res.writeHead(302, { location: "/#seo" }); return res.end(); }
    const user = auth.authenticate(bearer(req));
    if (url.pathname.startsWith("/api/") && !user) return json(res, { error: "Authentication required" }, 401);
    if (url.pathname === "/api/navigation" && req.method === "GET") { await workspaceFor(user); return json(res, lifecycle.navigationFor(user.id).tree({ includeHidden: url.searchParams.get("includeHidden") !== "false" })); }
    if (url.pathname === "/api/guide/context" && req.method === "GET") { await workspaceFor(user); return json(res, guide.context(user.id, { route: url.searchParams.get("route") ?? "/home" })); }
    if (url.pathname === "/api/guide/suggestions" && req.method === "GET") { await workspaceFor(user); return json(res, guide.suggestions(user.id)); }
    if (url.pathname === "/api/guide/setup-playbooks" && req.method === "GET") return json(res, listSetupPlaybooks());
    if (url.pathname.startsWith("/api/guide/setup-playbooks/") && req.method === "GET") return json(res, setupPlaybook(url.pathname.split("/").pop()));
    if (url.pathname === "/api/guide/external/start" && req.method === "POST") return json(res, externalGuide.start(await body(req)), 201);
    if (url.pathname.startsWith("/api/guide/external/") && url.pathname.endsWith("/observe") && req.method === "POST") return json(res, externalGuide.observe(url.pathname.split("/")[4], await body(req)));
    if (url.pathname.startsWith("/api/guide/external/") && url.pathname.endsWith("/advance") && req.method === "POST") return json(res, externalGuide.advance(url.pathname.split("/")[4]));
    if (url.pathname.startsWith("/api/guide/external/") && url.pathname.endsWith("/complete") && req.method === "POST") return json(res, externalGuide.complete(url.pathname.split("/")[4]));
    if (url.pathname === "/api/guide/message" && req.method === "POST") { await workspaceFor(user); const input = await body(req); return json(res, await guide.message(user.id, { text: input.text, route: input.route })); }
    // Actions are proposals until core validates them (guide spec section 39).
    if (url.pathname === "/api/guide/action" && req.method === "POST") { await workspaceFor(user); const result = await guide.actions.execute(user.id, await body(req)); return json(res, result); }

    if (url.pathname === "/api/guide/pointai/match" && req.method === "POST") {
      const input = await body(req);
      const host = input.host ?? "internal";
      // A remembered element is re-resolved against the DOM as it is now; a signature that
      // no longer resolves deletes itself and matching runs again (spec section 28).
      const cached = await playbooks.resolve(user.id, { host, goal: input.goal, stepContext: input.stepContext, elements: input.elements ?? [] });
      if (cached) return json(res, { ...cached, confidence: "high", tier: "playbook", reasoning: "You have been shown this before." });
      const result = await pointai.match(user.id, { goal: input.goal, elements: input.elements ?? [], host });
      if (result.index !== null && result.confidence === "high") {
        await playbooks.remember(user.id, { host, goal: input.goal, stepContext: input.stepContext, element: result.element });
      }
      return json(res, result);
    }

    if (url.pathname === "/api/tasks" && req.method === "GET") return json(res, tasks.list(user.id, { status: url.searchParams.get("status") ?? undefined }));
    if (url.pathname === "/api/tasks" && req.method === "POST") { const input = await body(req); return json(res, await tasks.create(user.id, input), 201); }
    if (url.pathname.startsWith("/api/tasks/") && req.method === "POST") { const input = await body(req); return json(res, await tasks.setStatus(user.id, url.pathname.split("/").pop(), input.status)); }
    if (url.pathname.startsWith("/api/tasks/") && req.method === "DELETE") return json(res, await tasks.remove(user.id, url.pathname.split("/").pop()));

    if (url.pathname === "/api/apps" && req.method === "GET") { await workspaceFor(user); return json(res, lifecycle.catalog(user.id).map((app) => ({ ...app, health: lifecycle.health(user.id, app.id) }))); }
    if (url.pathname === "/api/marketplace/control-plane" && req.method === "GET") { await workspaceFor(user); const tenant = await tenants.get(user); const installed = new Set(lifecycle.list(user.id).map((item) => item.pluginId)); return json(res, controlPlaneMarketplace.catalog({ tenantId: user.id, channel: tenant.profile.releaseChannel ?? "stable" }).filter((item) => !installed.has(item.id))); }
    if (url.pathname === "/api/marketplace/packages" && req.method === "GET") { await workspaceFor(user); const apps = lifecycle.catalog(user.id); return json(res, latestFirstPartyPackages().map(({ content, ...item }) => { const required = item.requiredPlugins ?? []; const unavailable = required.filter((id) => !apps.some((app) => app.id === id && app.installed && app.state === "enabled" && app.installable)); return { ...item, installable: unavailable.length === 0, unavailable, note: unavailable.length ? `Enable ${unavailable.join(", ")} first` : "Runs only through approved plugin capabilities and workflows." }; })); }
    if (url.pathname === "/api/marketplace/packages/installed" && req.method === "GET") return json(res, (await tenants.get(user)).packages ?? []);
    if (url.pathname.startsWith("/api/marketplace/packages/") && url.pathname.endsWith("/install") && req.method === "POST") { const parts = url.pathname.split("/"); const packageType = parts[4]; const packageId = parts[5]; const manifest = latestFirstPartyPackages().find((item) => item.type === packageType && item.id === packageId); if (!manifest) throw new Error("That package is not published"); const apps = lifecycle.catalog(user.id); const unavailable = (manifest.requiredPlugins ?? []).filter((id) => !apps.some((app) => app.id === id && app.installed && app.state === "enabled" && app.installable)); if (unavailable.length) throw new Error(`Enable ${unavailable.join(", ")} before installing this package`); const installed = await tenants.installPackage(user, manifest); audit.record({ action: "package.installed", ownerId: user.id, packageType, packageId }); return json(res, installed, 201); }
    if (url.pathname.startsWith("/api/marketplace/packages/") && (url.pathname.endsWith("/enable") || url.pathname.endsWith("/disable") || url.pathname.endsWith("/remove")) && req.method === "POST") { const parts = url.pathname.split("/"); const packageType = parts[4]; const packageId = parts[5]; const action = parts[6]; const result = action === "remove" ? await tenants.uninstallPackage(user, packageType, packageId) : await tenants.setPackageState(user, packageType, packageId, action === "enable" ? "enabled" : "disabled"); audit.record({ action: `package.${action}`, ownerId: user.id, packageType, packageId }); return json(res, result); }
    if (url.pathname.startsWith("/api/marketplace/control-plane/") && url.pathname.endsWith("/install") && req.method === "POST") { await workspaceFor(user); const pluginId = url.pathname.split("/")[4]; const tenant = await tenants.get(user); const installed = await controlPlaneMarketplace.install(pluginId, { tenantId: user.id, channel: tenant.profile.releaseChannel ?? "stable" }); await plugins.registerDirectory(installed.path); await lifecycle.install(user.id, pluginId); audit.record({ action: "marketplace.control-plane-installed", ownerId: user.id, pluginId, version: installed.version, checksum: installed.checksum }); return json(res, installed, 201); }
    if (url.pathname.startsWith("/api/marketplace/control-plane/") && (url.pathname.endsWith("/update") || url.pathname.endsWith("/rollback")) && req.method === "POST") { await workspaceFor(user); const parts = url.pathname.split("/"); const pluginId = parts[4]; const tenant = await tenants.get(user); const current = lifecycle.list(user.id).find((item) => item.pluginId === pluginId); if (!current) throw new Error("That plugin is not installed"); const input = await body(req); const version = parts[5] === "rollback" ? input.version : undefined; const installed = version ? await controlPlaneMarketplace.installVersion(pluginId, version, { tenantId: user.id, channel: tenant.profile.releaseChannel ?? "stable" }) : await controlPlaneMarketplace.install(pluginId, { tenantId: user.id, channel: tenant.profile.releaseChannel ?? "stable" }); await plugins.registerDirectory(installed.path); const updated = await lifecycle.update(user.id, pluginId); audit.record({ action: version ? "marketplace.control-plane-rolled-back" : "marketplace.control-plane-updated", ownerId: user.id, pluginId, from: current.version, to: installed.version, checksum: installed.checksum }); return json(res, { ...installed, ...updated }); }
    if (url.pathname.startsWith("/api/apps/") && req.method === "POST") {
      await workspaceFor(user);
      const [, , , pluginId, action] = url.pathname.split("/");
      if (action === "install") { const listing = lifecycle.catalog(user.id).find((item) => item.id === pluginId); if (!listing) throw new Error("That app is not in the marketplace"); if (!listing.installable) throw new Error(`${listing.name} is ${listing.readiness.label.toLowerCase()} and cannot be installed for customers yet`); const result = await lifecycle.install(user.id, pluginId); return json(res, { ...result, health: lifecycle.health(user.id, pluginId) }, result.alreadyInstalled ? 200 : 201); }
      if (action === "enable" || action === "disable") { const record = await lifecycle.setState(user.id, pluginId, action === "enable" ? "enabled" : "disabled"); return json(res, { record, health: lifecycle.health(user.id, pluginId) }); }
      if (action === "update") return json(res, await lifecycle.update(user.id, pluginId));
      // Deleting the app's history is a separate, irreversible decision from removing the
      // app, so the caller has to state it rather than inherit a default (plan section 90).
      if (action === "uninstall") { const input = await body(req); if (typeof input.keepData !== "boolean") throw new Error("Choose whether to keep this app's data before uninstalling"); return json(res, await lifecycle.uninstall(user.id, pluginId, { keepData: input.keepData })); }
      throw new Error(`Unknown app action: ${action}`);
    }
    if (url.pathname === "/api/auth/logout" && req.method === "POST") { auth.logout(bearer(req)); return json(res, { ok: true }); }
    if (url.pathname === "/api/auth/password" && req.method === "POST") { const updated = await auth.changePassword(user.id, await body(req)); audit.record({ action: "auth.password-changed", ownerId: user.id }); return json(res, { user: updated }); }
    if (url.pathname === "/api/state" && req.method === "GET") { await workspaceFor(user); const tenant = await tenants.get(user); const brain = await brains.get(user.id); const aiStatus = await ai.status(); const router = new ModelRouter({ configured: (provider) => provider === "ollama" ? aiStatus.ollama.available : vault.has(user.id, "ai") || vault.has(user.id, provider) }); return json(res, { user, metrics: store.state.metrics, activity: store.state.activity, profile: tenant.profile, catalog: tenant.catalog, brain: brain.list(), skills: brain.snapshot().skills, workflows: workflows.list({ tenantId: user.id }), approvals: workflows.list({ tenantId: user.id, status: "awaiting-approval" }), sandboxRuns: sandbox.list(), pricingRuns: tenant.pricingRuns ?? [], seoAudits: tenant.seoAudits ?? [], searchConsoleImports: tenant.searchConsoleImports ?? [], seoOpportunities: tenant.seoOpportunities ?? [], seoExperiments: tenant.seoExperiments ?? [], plugins: plugins.list(), apps: lifecycle.catalog(user.id).map((app) => ({ ...app, health: lifecycle.health(user.id, app.id) })), marketplace: marketplace.list(), capabilities: registry.list(), audit: audit.list().filter((entry) => !entry.ownerId || entry.ownerId === user.id).slice(-100), integrations: vault.status(user.id), aiStatus, modelRoute: router.select({ mode: tenant.profile.aiMode ?? "balanced" }) }); }
    if (url.pathname === "/api/profile" && req.method === "PUT") { const input = await body(req); const profile = await tenants.updateProfile(user, input); const brain = await brains.get(user.id); const added = []; for (const [key, value] of Object.entries({ business_name: profile.businessName, industry: profile.industry, website: profile.website, location: [profile.city, profile.state, profile.country].filter(Boolean).join(", "), business_description: profile.description })) if (value && !brain.list().some((record) => record.key === key && record.value === value)) added.push(await brain.add({ type: "fact", key, value: String(value), source: "company profile", confidence: 1, status: "verified", tags: ["profile"] }, { verifiedBy: user.name })); await safeIndex(user.id, added.map(knowledgeDocument)); return json(res, profile); }
    if (url.pathname === "/api/credentials" && req.method === "POST") { const input = await body(req); await vault.set(user.id, input.provider, input.secret); audit.record({ action: "credential.configured", provider: input.provider, ownerId: user.id }); return json(res, { integrations: vault.status(user.id) }, 201); }
    if (url.pathname === "/api/model-route" && req.method === "POST") { const input = await body(req); const status = await ai.status(); return json(res, new ModelRouter({ configured: (provider) => provider === "ollama" ? status.ollama.available : vault.has(user.id, "ai"), localModel: input.localModel ?? "qwen3:4b-instruct" }).select(input)); }
    if (url.pathname === "/api/ai/pull" && req.method === "POST") { const input = await body(req); return json(res, await ai.pullModel(input.model)); }
    if (url.pathname === "/api/ai/chat" && req.method === "POST") { const input = await body(req); if (!String(input.prompt ?? "").trim()) throw new Error("A prompt is required"); const tenant = await tenants.get(user); const brain = await brains.get(user.id); const keywordContext = brain.resolve(input.prompt, { limit: 8 }); let semanticContext = []; try { semanticContext = await (await semantic.get(user.id)).search(input.prompt, { limit: 8 }); } catch (error) { audit.record({ action: "semantic.search-fallback", ownerId: user.id, reason: error.message }); } const status = await ai.status(); const router = new ModelRouter({ configured: (provider) => provider === "ollama" ? status.ollama.available : vault.has(user.id, "ai") }); const route = router.select({ mode: input.mode ?? tenant.profile.aiMode ?? "balanced", task: input.task ?? "reasoning", requiresPrivate: input.requiresPrivate }); const companyContext = { profile: tenant.profile, catalog: tenant.catalog.slice(0, 30), knowledge: keywordContext.records, semanticContext, skills: keywordContext.skills }; const result = await ai.generate({ route, apiKey: vault.get(user.id, "ai") ?? vault.get(user.id, "gemini"), messages: [{ role: "system", content: `You are BusinessOS, a careful business operations assistant. Use only verified company context. State when information is missing. Never claim an external action was performed. Company context: ${JSON.stringify(companyContext)}` }, { role: "user", content: input.prompt }], structured: input.structured === true }); audit.record({ action: "ai.generated", ownerId: user.id, provider: result.provider, model: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }); return json(res, result); }
    if (url.pathname === "/api/sandbox/run" && req.method === "POST") return json(res, sandbox.execute(await body(req)), 201);
    if (url.pathname === "/api/catalog" && req.method === "GET") return json(res, await tenants.listCatalog(user));
    if (url.pathname === "/api/catalog/workbook" && req.method === "GET") return json(res, await tenants.getWorkbook(user));
    if (url.pathname === "/api/catalog/workbook" && req.method === "POST") { const input = await body(req); const result = await tenants.updateWorkbook(user, input); audit.record({ action: "catalog.workbook.updated", ownerId: user.id, operation: input.type }); return json(res, result); }
    if (url.pathname === "/api/catalog/workbook/export" && req.method === "GET") { const workbook = await tenants.getWorkbook(user); return json(res, { filename: "businessos-catalog.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data: await createXlsx(workbook) }); }
    if (url.pathname === "/api/catalog/workbook/import" && req.method === "POST") { const input = await body(req); const tables = [...(input.tables ?? [])]; for (const file of input.files ?? []) tables.push(file.format === "xlsx" ? await parseXlsx(file.content, file.name) : parseCatalog(file.content, file.format ?? "csv")); const result = await tenants.importWorkbook(user, tables); audit.record({ action: "catalog.workbook.imported", ownerId: user.id, tables: tables.length, rows: result.workbook.rows.length }); return json(res, result, 201); }
    if (url.pathname === "/api/demo/seed" && req.method === "POST") { const demo = await tenants.seedDemo(user); const brain = await brains.get(user.id); const facts = []; for (const [key, value] of Object.entries({ business_name: demo.profile.businessName, industry: demo.profile.industry, location: `${demo.profile.city}, ${demo.profile.state}, ${demo.profile.country}`, business_description: demo.profile.description, primary_goal: demo.profile.goals[0], external_writes: "Disabled in demo environment" })) facts.push(await brain.add({ type: key === "external_writes" ? "policy" : "fact", key, value, source: "demo tenant seed", confidence: 1, status: "verified", tags: ["demo"] }, { verifiedBy: user.name })); await safeIndex(user.id, [...facts.map(knowledgeDocument), ...demo.catalog.map(catalogDocument)]); const workflow = await workflows.request({ tenantId: user.id, name: "Review initial Jaipur SEO opportunity plan", capability: "seo.audit", risk: "high", input: { website: demo.profile.website }, preview: { proposedActions: ["Audit page titles and descriptions", "Check NAP consistency", "Map verified services to Jaipur search intent"], externalWrites: false }, evidence: ["Demo company profile", "Three verified demo catalog items"], expectedEffect: "Create an internal SEO baseline plan; no website or Google changes", idempotencyKey: `demo-baseline:${user.id}` }); audit.record({ action: "demo-tenant.seeded", ownerId: user.id }); return json(res, { ...demo, workflow }, 201); }
    if (url.pathname === "/api/catalog/import" && req.method === "POST") { const input = await body(req); const products = parseCatalog(input.content, input.format); const catalog = await tenants.importCatalog(user, products); await safeIndex(user.id, catalog.map(catalogDocument)); audit.record({ action: "catalog.imported", ownerId: user.id, count: catalog.length }); return json(res, { catalog, imported: products.length }, 201); }
    if (url.pathname === "/api/pricing/stage" && req.method === "POST") { const tenant = await tenants.get(user); const run = await pricingAgent.stage(user.id, tenant.catalog); await tenants.addPricingRun(user, run); audit.record({ action: "pricing-agent.staging-completed", ownerId: user.id, runId: run.id, recommendations: run.recommendations.length }); return json(res, run, 201); }
    if (url.pathname === "/api/seo/audit" && req.method === "POST") { const input = await body(req); const tenant = await tenants.get(user); const target = input.url ?? tenant.profile.website; if (!target) throw new Error("Add a public website URL to the company profile first"); const result = await websiteAuditor.auditSite(target, { maxPages: input.maxPages ?? 10 }); await tenants.addSeoAudit(user, result); audit.record({ action: "seo.audit-completed", ownerId: user.id, auditId: result.id, pages: result.pagesAudited, score: result.averageScore }); return json(res, result, 201); }
    if (url.pathname === "/api/search-console/import" && req.method === "POST") {
      const input = await body(req); let snapshot;
      if (input.rows) snapshot = { id: crypto.randomUUID(), siteUrl: input.siteUrl, startDate: input.startDate, endDate: input.endDate, rows: input.rows, source: "manual-secure-import", importedAt: new Date().toISOString() };
      else {
        let config = JSON.parse(vault.get(user.id, "search_console") ?? "null"); if (!config?.accessToken) throw new Error("Connect Search Console or provide an immutable row snapshot");
        if (config.expiresAt && config.expiresAt < Date.now() + 60_000) { config = await searchConsoleOAuth.refresh(config); await vault.set(user.id, "search_console", JSON.stringify(config)); }
        snapshot = { id: crypto.randomUUID(), ...(await new SearchConsoleClient({ accessToken: config.accessToken }).query({ siteUrl: config.siteUrl, startDate: input.startDate, endDate: input.endDate })), source: "google-search-console-api" };
      }
      Object.freeze(snapshot.rows); await tenants.addSearchConsoleImport(user, snapshot); audit.record({ action: "search-console.snapshot-imported", ownerId: user.id, snapshotId: snapshot.id, rows: snapshot.rows.length }); return json(res, snapshot, 201);
    }
    if (url.pathname === "/api/search-console/config" && req.method === "POST") { const input = await body(req); if (!String(input.siteUrl ?? "").startsWith("http")) throw new Error("A Search Console property URL is required"); await vault.set(user.id, "search_console", JSON.stringify({ siteUrl: input.siteUrl, accessToken: input.accessToken })); audit.record({ action: "search-console.connected", ownerId: user.id, siteUrl: input.siteUrl }); return json(res, { configured: true }, 201); }
    if (url.pathname === "/api/search-console/oauth/start" && req.method === "POST") { const input = await body(req); const authUrl = searchConsoleOAuth.begin({ ownerId: user.id, clientId: input.clientId, clientSecret: input.clientSecret, siteUrl: input.siteUrl, redirectUri: input.redirectUri }); audit.record({ action: "search-console.oauth-started", ownerId: user.id, siteUrl: input.siteUrl }); return json(res, { authUrl }); }
    if (url.pathname === "/api/wordpress/config" && req.method === "POST") { const input = await body(req); if (!String(input.siteUrl ?? "").startsWith("https://")) throw new Error("WordPress staging URL must use HTTPS"); const tenant = await tenants.get(user); if (new URL(input.siteUrl).origin === new URL(tenant.profile.website).origin) throw new Error("Staging WordPress must not be the production origin"); await vault.set(user.id, "wordpress_staging", JSON.stringify({ siteUrl: input.siteUrl, username: input.username, applicationPassword: input.applicationPassword })); const health = await new WordPressStagingConnector({ siteUrl: input.siteUrl, username: input.username, applicationPassword: input.applicationPassword }).health(); if (!health.staging) throw new Error("WordPress connector did not confirm staging mode"); audit.record({ action: "wordpress-staging.connected", ownerId: user.id, siteUrl: input.siteUrl }); return json(res, health, 201); }
    if (url.pathname === "/api/seo/opportunities/discover" && req.method === "POST") { const tenant = await tenants.get(user); const snapshot = tenant.searchConsoleImports?.[0]; const website = tenant.seoAudits?.[0]; if (!snapshot) throw new Error("Import Search Console evidence first"); if (!website) throw new Error("Run the public website crawl first"); const brain = await brains.get(user.id); const refs = brain.list().filter((record) => record.status === "verified"); const pages = website.pages.map((page) => ({ ...page, snapshotRef: `${website.id}:${page.url}` })); const opportunities = opportunityEngine.discover({ tenantId: user.id, rows: snapshot.rows.map((row) => ({ ...row, query: row.query ?? row.keys?.[0], page: row.page ?? row.keys?.[1] })), pages, companyBrainRefs: refs, searchConsoleSnapshotRef: snapshot.id }); await tenants.saveSeoOpportunities(user, opportunities); audit.record({ action: "seo.opportunities-discovered", ownerId: user.id, count: opportunities.length, searchConsoleSnapshotRef: snapshot.id }); return json(res, opportunities, 201); }
    if (url.pathname === "/api/seo/proposals" && req.method === "POST") { const input = await body(req); const tenant = await tenants.get(user); const opportunity = tenant.seoOpportunities?.find((item) => item.id === input.opportunityId); if (!opportunity) throw new Error("SEO opportunity not found"); const current = tenant.seoAudits?.flatMap((item) => item.pages).find((page) => page.url === opportunity.page); if (!current) throw new Error("Current page snapshot not found"); const brain = await brains.get(user.id); const verified = brain.list().filter((record) => record.status === "verified"); const status = await ai.status(); const route = new ModelRouter({ configured: (provider) => provider === "ollama" ? status.ollama.available : vault.has(user.id, "ai") }).select({ mode: tenant.profile.aiMode }); const generation = await ai.generate({ route, apiKey: vault.get(user.id, "ai"), structured: true, messages: [{ role: "system", content: `Generate one conservative SEO title and meta description. Return JSON only with title and metaDescription. Use verified context only. Opportunity: ${JSON.stringify(opportunity.evidence)}. Verified context: ${JSON.stringify(verified.map(({ id, key, value }) => ({ id, key, value })))}. Current title: ${current.title}. Current meta: ${current.description}. Title 25-65 characters. Meta 70-170 characters. Never invent prices, guarantees, services or locations.` }] }); const proposed = parseJsonObject(generation.text); const proposal = { id: crypto.randomUUID(), version: 1, targetUrl: opportunity.page, current: { title: current.title, metaDescription: current.description }, proposed: { title: proposed.title, metaDescription: proposed.metaDescription }, model: generation.model, modelMode: route.mode, companyBrainRefs: opportunity.evidence.companyBrainRefs, createdAt: new Date().toISOString() }; const validation = prePublishValidator.validate({ proposal, currentPage: { url: current.url, canonical: current.canonical }, verifiedServices: tenant.catalog.map((item) => item.name), verifiedLocations: [tenant.profile.city, tenant.profile.state, ...(tenant.profile.serviceAreas ?? [])].filter(Boolean), knownPrices: tenant.catalog.map((item) => item.price).filter(Boolean) }); if (!validation.passed) { audit.record({ action: "seo.validation-failed", ownerId: user.id, agentRunId: proposal.id, opportunityId: opportunity.id, model: generation.model, validation }); return json(res, { proposal, validation, status: "VALIDATION_FAILED" }, 422); } let experiment = seoExperiments.create({ tenantId: user.id, opportunity, proposal, validation }); experiment = seoExperiments.transition(experiment, "AWAITING_APPROVAL"); const approval = await workflows.request({ tenantId: user.id, name: `Approve SEO experiment for ${opportunity.primaryQuery}`, capability: "wordpress.staging.draft.create", risk: "high", input: { experimentId: experiment.id, proposalVersion: 1, proposed: proposal.proposed }, preview: { opportunity, current: proposal.current, proposed: proposal.proposed, validation }, evidence: [opportunity.evidence], expectedEffect: "Create a staging-only WordPress draft; production remains unchanged", oldValue: proposal.current, newValue: proposal.proposed, idempotencyKey: `seo-experiment:${experiment.id}` }); experiment = { ...experiment, approvalWorkflowId: approval.id }; await tenants.saveSeoExperiment(user, experiment); audit.record({ action: "seo.proposal-awaiting-approval", ownerId: user.id, agentRunId: proposal.id, experimentId: experiment.id, opportunityId: opportunity.id, proposalHash: validation.proposalHash, model: generation.model, modelMode: route.mode, validation, companyBrainRefs: proposal.companyBrainRefs }); return json(res, { experiment, approval, validation }, 201); }
    if (url.pathname === "/api/seo/publish-staging" && req.method === "POST") {
      const input = await body(req); const tenant = await tenants.get(user); let experiment = tenant.seoExperiments?.find((item) => item.id === input.experimentId);
      if (!experiment) throw new Error("SEO experiment not found");
      const approval = workflows.list({ tenantId: user.id }).find((run) => run.id === experiment.approvalWorkflowId);
      if (!approval || approval.status !== "completed") throw new Error("The exact proposal must be approved in Needs You first");
      const approvedPayload = approval.input.proposed; const originalProposal = experiment.proposalVersions.at(-1);
      if (payloadHash(originalProposal.proposed) !== payloadHash(approvedPayload)) experiment = seoExperiments.addProposal(experiment, { ...originalProposal, id: crypto.randomUUID(), proposed: approvedPayload, source: "owner-edit", createdAt: approval.decidedAt });
      const current = tenant.seoAudits?.flatMap((item) => item.pages).find((page) => page.url === experiment.page);
      const validation = prePublishValidator.validate({ proposal: { ...originalProposal, proposed: approvedPayload }, currentPage: { url: current.url, canonical: current.canonical }, verifiedServices: tenant.catalog.map((item) => item.name), verifiedLocations: [tenant.profile.city, tenant.profile.state, ...(tenant.profile.serviceAreas ?? [])].filter(Boolean), knownPrices: tenant.catalog.map((item) => item.price).filter(Boolean) });
      if (!validation.passed) { experiment = seoExperiments.transition(experiment, "VALIDATION_FAILED", { validation }); await tenants.saveSeoExperiment(user, experiment); audit.record({ action: "seo.approved-payload-validation-failed", ownerId: user.id, experimentId: experiment.id, validation }); return json(res, experiment, 422); }
      experiment = seoExperiments.transition(experiment, "APPROVED", { approvedVersion: experiment.proposalVersions.length, approvedPayloadHash: payloadHash(approvedPayload), approver: user.id, approvalId: approval.id, approvedAt: approval.decidedAt });
      experiment = seoExperiments.transition(experiment, "STAGING_WRITE_STARTED"); await tenants.saveSeoExperiment(user, experiment);
      try {
        const config = JSON.parse(vault.get(user.id, "wordpress_staging") ?? "null"); if (!config) throw new Error("Connect the staging WordPress companion plugin first");
        const connector = new WordPressStagingConnector(config); const productionBefore = await publicSnapshot(experiment.page);
        const created = await connector.createDraft({ tenantId: user.id, experimentId: experiment.id, sourcePageId: input.sourcePageId, payload: approvedPayload });
        experiment = seoExperiments.transition(experiment, "VERIFICATION_PENDING", { stagingDraftId: created.id, wordpressRequestId: created.requestId });
        const stagingDraft = await connector.getDraft(created.id); const productionAfter = await publicSnapshot(experiment.page);
        const verification = postPublishVerifier.verify({ approvedPayload, approvedPayloadHash: experiment.approvedPayloadHash, stagingDraft, productionBefore, productionAfter });
        experiment = seoExperiments.transition(experiment, verification.passed ? "ACTIVE" : "VERIFICATION_FAILED", { verification, productionBefore, productionAfter, stagingDraft, activatedAt: verification.passed ? new Date().toISOString() : null }); await tenants.saveSeoExperiment(user, experiment);
        audit.record({ action: verification.passed ? "seo.experiment-active" : "seo.verification-failed", ownerId: user.id, tenant: user.id, environment: "staging", workflowRunId: approval.id, approvalId: approval.id, approver: user.id, approvalTimestamp: approval.decidedAt, agentRunId: originalProposal.id, experimentId: experiment.id, plugin: "seo", skill: "title-meta-experiment", searchConsoleEvidence: experiment.evidence.searchConsoleSnapshotRef, websiteSnapshot: experiment.evidence.websiteSnapshotRef, companyBrainRefs: experiment.evidence.companyBrainRefs, model: originalProposal.model, modelMode: originalProposal.modelMode, approvedVersion: experiment.approvedVersion, approvedPayloadHash: experiment.approvedPayloadHash, wordpressRequestId: stagingDraft.requestId, wordpressPageId: stagingDraft.id, verification, beforeSnapshot: productionBefore, afterSnapshot: productionAfter, rollbackReference: { draftId: stagingDraft.id, snapshot: originalProposal.current }, timestamps: experiment.history });
        return json(res, experiment, verification.passed ? 201 : 409);
      } catch (error) {
        if (experiment.status === "STAGING_WRITE_STARTED") experiment = seoExperiments.transition(experiment, "STAGING_WRITE_FAILED", { failure: error.message });
        else if (experiment.status === "VERIFICATION_PENDING") experiment = seoExperiments.transition(experiment, "VERIFICATION_FAILED", { failure: error.message });
        await tenants.saveSeoExperiment(user, experiment); audit.record({ action: experiment.status === "STAGING_WRITE_FAILED" ? "seo.staging-write-failed" : "seo.verification-failed", ownerId: user.id, experimentId: experiment.id, error: error.message });
        throw error;
      }
    }
    if (url.pathname === "/api/brain" && req.method === "POST") { const record = await (await brains.get(user.id)).add(await body(req), { verifiedBy: user.name }); await safeIndex(user.id, [knowledgeDocument(record)]); return json(res, record, 201); }
    if (url.pathname === "/api/semantic/reindex" && req.method === "POST") { const tenant = await tenants.get(user); const brain = await brains.get(user.id); const indexed = await safeIndex(user.id, [...brain.list().map(knowledgeDocument), ...tenant.catalog.map(catalogDocument)]); return json(res, { indexed: indexed.length }); }
    if (url.pathname === "/api/brain/resolve" && req.method === "POST") { const input = await body(req); return json(res, (await brains.get(user.id)).resolve(input.query, { limit: input.limit, types: input.types })); }
    if (url.pathname === "/api/brain/outcomes" && req.method === "POST") return json(res, await (await brains.get(user.id)).recordOutcome(await body(req)), 201);
    if (url.pathname === "/api/skills" && req.method === "POST") return json(res, await (await brains.get(user.id)).addSkill(await body(req)), 201);
    if (url.pathname === "/api/agent/plans" && req.method === "GET") return json(res, agentPlans.list(user.id));
    if (url.pathname === "/api/agent/plan" && req.method === "POST") {
      const input = await body(req);
      const plan = createAgentPlan({ tenantId: user.id, goal: input.goal, nodes: input.nodes, context: input.context, capabilities: registry.list(), createdBy: user.name ?? user.id });
      const workflow = await workflows.request({ tenantId: user.id, name: `Approve agent plan: ${plan.goal}`, capability: "agent.plan.approve", risk: "high", input: { planId: plan.id, planDigest: plan.digest }, preview: { goal: plan.goal, nodes: plan.nodes, order: plan.validation.order }, evidence: input.evidence ?? [], expectedEffect: "Approve a bounded plan; execution remains behind signed plugins and verification" });
      plan.workflowId = workflow.id; await agentPlans.create(plan); audit.record({ action: "agent.plan-proposed", ownerId: user.id, planId: plan.id, planDigest: plan.digest }); return json(res, { plan, workflow }, 201);
    }
    if (url.pathname.startsWith("/api/agent/plans/") && url.pathname.endsWith("/decision") && req.method === "POST") {
      const id = url.pathname.split("/")[4]; const input = await body(req); const plan = agentPlans.get(user.id, id); if (!plan) throw new Error("Agent plan not found");
      const workflow = await workflows.decide(plan.workflowId, input.decision, { tenantId: user.id, comment: input.comment }); const decided = await agentPlans.decide(user.id, id, input.decision === "approved" ? "approved" : "rejected", { comment: input.comment }); audit.record({ action: `agent.plan-${decided.status}`, ownerId: user.id, planId: id }); return json(res, { plan: decided, workflow });
    }
    if (url.pathname === "/api/workflows" && req.method === "GET") return json(res, workflows.list({ tenantId: user.id }));
    if (url.pathname === "/api/workflows" && req.method === "POST") { const input = await body(req); const tenant = await tenants.get(user); const externalBlocked = input.externalEffect === true && tenant.profile.externalWritesEnabled !== true; return json(res, await workflows.request({ ...input, tenantId: user.id, allowed: externalBlocked ? false : input.allowed, expectedEffect: externalBlocked ? `${input.expectedEffect ?? "External action"} (blocked by global external-write switch)` : input.expectedEffect }), 201); }
    if (url.pathname === "/api/safety" && req.method === "PUT") { const input = await body(req); if (input.externalWritesEnabled === true && input.confirmation !== "ENABLE EXTERNAL WRITES") throw new Error("Type ENABLE EXTERNAL WRITES to enable the global write switch"); const profile = await tenants.updateProfile(user, { environment: input.environment ?? "development", externalWritesEnabled: input.externalWritesEnabled === true }); audit.record({ action: input.externalWritesEnabled ? "external-writes.enabled" : "external-writes.disabled", ownerId: user.id, environment: profile.environment }); return json(res, { environment: profile.environment, externalWritesEnabled: profile.externalWritesEnabled }); }
    if (url.pathname.startsWith("/api/workflows/") && req.method === "POST") { const input = await body(req); return json(res, await workflows.decide(url.pathname.split("/").pop(), input.decision, { tenantId: user.id, comment: input.comment, editedInput: input.editedInput })); }
    if (url.pathname.startsWith("/api/approvals/") && req.method === "POST") { const input = await body(req); const workflowId = url.pathname.split("/").pop(); const decided = await workflows.decide(workflowId, input.decision, { tenantId: user.id, comment: input.comment, editedInput: input.editedInput }); if (decided.status === "rejected") { const tenant = await tenants.get(user); const experiment = tenant.seoExperiments?.find((item) => item.approvalWorkflowId === workflowId && item.status === "AWAITING_APPROVAL"); if (experiment) await tenants.saveSeoExperiment(user, seoExperiments.transition(experiment, "REJECTED", { rejectionComment: input.comment, rejectedAt: decided.decidedAt })); } return json(res, decided); }
    if (url.pathname === "/api/marketplace/github" && req.method === "POST") {
      if (!developerMode) return json(res, { error: "Registering a GitHub repository is a developer tool. Start BusinessOS with BUSINESSOS_DEVELOPER_MODE=1 to use it." }, 403);
      return json(res, await marketplace.registerGithub(await body(req)), 201);
    }
    // The legacy dashboard stays reachable at /legacy/* while the SPA reaches parity.
    const legacy = url.pathname.startsWith("/legacy/");
    const root = legacy ? legacyRoot : webRoot;
    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = resolve(root, `.${requested}`);
    if (!file.startsWith(root)) return json(res, { error: "forbidden" }, 403);
    try {
      const content = await readFile(file);
      res.writeHead(200, { "content-type": staticTypes[extname(file)] ?? "text/plain" }); res.end(content); return;
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "EISDIR") throw error;
    }
    // Client-side routes (/home, /apps/seo, ...) are not files. Anything that is not an
    // API call or an asset request falls back to the SPA entry so deep links work.
    if (spaBuilt && !legacy && !extname(url.pathname)) {
      const shell = await readFile(resolve(spaRoot, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(shell); return;
    }
    return json(res, { error: "Not found" }, 404);
  } catch (error) { json(res, { error: error.message }, 400); }
});
const port = Number(process.env.PORT ?? 4173); const host = process.env.HOST ?? "127.0.0.1"; server.listen(port, host, () => console.log(`BusinessOS dashboard: http://${host}:${port}`));
