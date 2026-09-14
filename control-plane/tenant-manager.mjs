import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sanitizeHeartbeat } from "./telemetry-contract.mjs";

// Tenant manager: the operator's view of every installation (operator plan sections 2, 3
// and 10).
//
// Everything stored here arrives through `sanitizeHeartbeat`, so this file cannot become a
// back door for business data even if a caller passes something it should not.

export const PLANS = {
  free:    { name: "Free",    slots: 2 },
  starter: { name: "Starter", slots: 5 },
  growth:  { name: "Growth",  slots: 10 },
  pro:     { name: "Pro",     slots: Infinity },
};

// An installation that has not been heard from in this long is reported as stale rather
// than healthy — silence is not health.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export class TenantManager {
  constructor({ stateFile, clock = () => Date.now() } = {}) {
    this.stateFile = stateFile;
    this.clock = clock;
    this.tenants = new Map();
  }

  async load() {
    if (!this.stateFile) return this;
    await mkdir(dirname(this.stateFile), { recursive: true });
    try {
      for (const tenant of JSON.parse(await readFile(this.stateFile, "utf8"))) this.tenants.set(tenant.tenantId, tenant);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    return this;
  }

  async save() {
    if (this.stateFile) await writeFile(this.stateFile, JSON.stringify([...this.tenants.values()], null, 2));
  }

  async register({ tenantId, companyName, plan = "free", channel = "stable" }) {
    if (!tenantId) throw new Error("A tenant needs an id");
    if (!PLANS[plan]) throw new Error(`Unknown plan: ${plan}`);
    const existing = this.tenants.get(tenantId);
    const tenant = {
      tenantId, companyName: companyName ?? existing?.companyName ?? tenantId,
      plan, channel,
      entitlements: existing?.entitlements ?? [],
      users: existing?.users ?? [],
      assignments: existing?.assignments ?? [],
      featureFlags: existing?.featureFlags ?? {},
      coreVersion: existing?.coreVersion ?? null,
      plugins: existing?.plugins ?? [],
      healthState: existing?.healthState ?? "unknown",
      lastSeenAt: existing?.lastSeenAt ?? null,
      createdAt: existing?.createdAt ?? new Date(this.clock()).toISOString(),
    };
    this.tenants.set(tenantId, tenant);
    await this.save();
    return tenant;
  }

  // The only way installation state enters the control plane.
  async heartbeat(input) {
    const beat = sanitizeHeartbeat(input);
    const tenant = this.tenants.get(beat.tenantId) ?? await this.register({ tenantId: beat.tenantId, companyName: beat.companyName });
    Object.assign(tenant, {
      companyName: beat.companyName ?? tenant.companyName,
      coreVersion: beat.coreVersion ?? tenant.coreVersion,
      healthState: beat.healthState ?? tenant.healthState,
      plugins: beat.plugins,
      lastSeenAt: new Date(this.clock()).toISOString(),
    });
    await this.save();
    return tenant;
  }

  async setPlan(tenantId, plan) {
    if (!PLANS[plan]) throw new Error(`Unknown plan: ${plan}`);
    const tenant = this.#require(tenantId);
    tenant.plan = plan;
    await this.save();
    return tenant;
  }

  async setChannel(tenantId, channel) {
    const tenant = this.#require(tenantId);
    tenant.channel = channel;
    await this.save();
    return tenant;
  }

  // A grant lets one company have one app its plan would not normally include — the
  // mechanism behind "included for you" and custom client work.
  async grant(tenantId, pluginId) {
    const tenant = this.#require(tenantId);
    if (!tenant.entitlements.includes(pluginId)) tenant.entitlements.push(pluginId);
    await this.save();
    return tenant;
  }

  async revoke(tenantId, pluginId) {
    const tenant = this.#require(tenantId);
    tenant.entitlements = tenant.entitlements.filter((item) => item !== pluginId);
    await this.save();
    return tenant;
  }

  async addUser(tenantId, userId, name = "") {
    if (!userId) throw new Error("A user needs an id");
    const tenant = this.#require(tenantId);
    if (!tenant.users.some((user) => user.userId === userId)) tenant.users.push({ userId, name });
    await this.save();
    return tenant;
  }

  async removeUser(tenantId, userId) {
    const tenant = this.#require(tenantId);
    tenant.users = tenant.users.filter((user) => user.userId !== userId);
    await this.save();
    return tenant;
  }

  async assignPlugin(tenantId, pluginId, userId = null) {
    const tenant = this.#require(tenantId);
    if (userId && !tenant.users.some((user) => user.userId === userId)) throw new Error(`Unknown user: ${userId}`);
    if (!tenant.assignments.some((assignment) => assignment.pluginId === pluginId && assignment.userId === userId)) tenant.assignments.push({ pluginId, userId, assignedBy: "operator", assignedAt: new Date().toISOString() });
    await this.save();
    return tenant;
  }

  async unassignPlugin(tenantId, pluginId, userId = null) {
    const tenant = this.#require(tenantId);
    tenant.assignments = tenant.assignments.filter((assignment) => !(assignment.pluginId === pluginId && (!userId || assignment.userId === userId)));
    await this.save();
    return tenant;
  }

  #require(tenantId) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Unknown tenant: ${tenantId}`);
    return tenant;
  }

  get(tenantId) { return this.tenants.get(tenantId) ?? null; }

  // Slot limits are reported, never enforced retroactively: a company that drops to a
  // smaller plan keeps what it installed until it chooses what to remove. Silently
  // disabling an app someone relies on would be worse than being over the limit.
  slots(tenantId) {
    const tenant = this.#require(tenantId);
    const limit = PLANS[tenant.plan].slots;
    const used = tenant.plugins.length;
    return { plan: tenant.plan, limit, used, remaining: limit === Infinity ? Infinity : Math.max(0, limit - used), overLimit: used > limit };
  }

  health(tenantId) {
    const tenant = this.#require(tenantId);
    if (!tenant.lastSeenAt) return { state: "unknown", reason: "This installation has never checked in." };
    const age = this.clock() - Date.parse(tenant.lastSeenAt);
    if (age > STALE_AFTER_MS) return { state: "unknown", reason: `Last seen ${Math.round(age / 3600000)} hours ago.` };
    return { state: tenant.healthState, reason: null };
  }

  list() { return [...this.tenants.values()]; }

  // The operator overview (section 2 of the plan).
  overview() {
    const tenants = this.list();
    const states = tenants.map((tenant) => this.health(tenant.tenantId).state);
    return {
      companies: tenants.length,
      installations: tenants.filter((tenant) => tenant.lastSeenAt).length,
      healthy: states.filter((state) => state === "healthy").length,
      needsAttention: states.filter((state) => state === "attention" || state === "failed").length,
      unknown: states.filter((state) => state === "unknown").length,
      pluginInstalls: tenants.reduce((total, tenant) => total + tenant.plugins.length, 0),
      byPlan: Object.fromEntries(Object.keys(PLANS).map((plan) => [plan, tenants.filter((tenant) => tenant.plan === plan).length])),
    };
  }
}
