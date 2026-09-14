import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { NavigationRegistry } from "../navigation/navigation-registry.mjs";

// Plugin lifecycle for the apps bundled with the product (GrowthOS plan section 9 and 96).
// Installation is per tenant: the same runtime discovers every manifest, but which apps a
// company actually has is that company's state and is persisted.
//
// Marketplace (core/plugins/marketplace.mjs) stays responsible for externally sourced
// GitHub entries and their review gate. This service never installs from a URL.

const STATES = new Set(["installed", "configured", "enabled", "disabled"]);
const ACTIVE = "enabled";

// Section 84: a new printing business starts with these, not with all seventeen.
const DEFAULT_APPS = ["catalog", "seo", "pricing"];

const key = (tenantId, pluginId) => `${tenantId}:${pluginId}`;

export class PluginLifecycle {
  constructor({ stateFile, pluginManager, audit, eventBus, capabilityRegistry, iconExists } = {}) {
    this.iconExists = iconExists;
    this.stateFile = stateFile;
    this.plugins = pluginManager;
    this.audit = audit;
    this.eventBus = eventBus;
    this.capabilityRegistry = capabilityRegistry;
    this.installations = new Map();
    this.navigations = new Map();
  }

  async load() {
    if (!this.stateFile) return this.list();
    await mkdir(dirname(this.stateFile), { recursive: true });
    try {
      for (const record of JSON.parse(await readFile(this.stateFile, "utf8"))) {
        this.installations.set(key(record.tenantId, record.pluginId), record);
      }
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    return this.list();
  }

  async save() {
    if (this.stateFile) await writeFile(this.stateFile, JSON.stringify([...this.installations.values()], null, 2));
  }

  #manifest(pluginId) {
    const manifest = this.plugins?.manifestFor(pluginId);
    if (!manifest) throw new Error(`Unknown app: ${pluginId}`);
    return manifest;
  }

  #record(tenantId, pluginId) {
    return this.installations.get(key(tenantId, pluginId)) ?? null;
  }

  // Navigation is derived from installations, so it can never claim an app the tenant
  // does not have, and is built lazily from the records rather than accumulated as
  // installs happen — a restart that loads installations.json from disk then produces the
  // same navigation as the session that wrote it.
  navigationFor(tenantId) {
    return this.navigations.get(tenantId) ?? this.#syncNavigation(tenantId);
  }

  #syncNavigation(tenantId) {
    const registry = new NavigationRegistry({ audit: this.audit, iconExists: this.iconExists });
    for (const record of this.list(tenantId)) {
      registry.register(this.#manifest(record.pluginId), { state: record.state });
    }
    this.navigations.set(tenantId, registry);
    return registry;
  }

  list(tenantId) {
    const records = [...this.installations.values()];
    const scoped = tenantId ? records.filter((record) => record.tenantId === tenantId) : records;
    return scoped.sort((left, right) => left.order - right.order);
  }

  // What the Apps & Features screen renders: every bundled app, installed or not.
  catalog(tenantId) {
    return (this.plugins?.list() ?? []).map(({ id }) => {
      const manifest = this.#manifest(id);
      const readiness = this.plugins?.readinessFor(id) ?? { stage: "scaffold", label: "Planned", installable: false };
      const record = this.#record(tenantId, id);
      return {
        id,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        category: manifest.category ?? "uncategorized",
        icon: manifest.assets?.icon ?? null,
        dependencies: manifest.dependencies ?? [],
        permissions: manifest.permissions?.required ?? [],
        deniedCapabilities: manifest.deniedCapabilities ?? [],
        readiness,
        installable: readiness.installable,
        installed: Boolean(record),
        state: record?.state ?? "available",
        installedVersion: record?.version ?? null,
        updateAvailable: Boolean(record) && record.version !== manifest.version,
        installedAt: record?.installedAt ?? null,
      };
    });
  }

  // Required dependencies are installed alongside, because an owner asked for a
  // capability, not for a dependency graph (plan section 1.2). Which ones came along is
  // reported back so the UI can say so.
  async install(tenantId, pluginId, { enable = true } = {}) {
    const manifest = this.#manifest(pluginId);
    const broughtIn = [];
    for (const dependency of manifest.dependencies ?? []) {
      if (!this.#record(tenantId, dependency)) {
        const nested = await this.install(tenantId, dependency, { enable });
        broughtIn.push(dependency, ...nested.broughtIn);
      }
    }

    const existing = this.#record(tenantId, pluginId);
    if (existing) return { record: existing, broughtIn, alreadyInstalled: true };

    const order = this.list(tenantId).length + 1;
    const record = {
      tenantId, pluginId, order,
      state: enable ? ACTIVE : "installed",
      version: manifest.version,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.installations.set(key(tenantId, pluginId), record);
    await this.save();
    this.#syncNavigation(tenantId);
    this.capabilityRegistry?.register(pluginId, manifest.capabilities ?? []);
    this.audit?.record({ action: "plugin.installed", tenantId, pluginId, version: manifest.version });
    await this.eventBus?.emit({ type: "plugin.installed", tenantId, pluginId });
    return { record, broughtIn, alreadyInstalled: false };
  }

  async setState(tenantId, pluginId, state) {
    if (!STATES.has(state)) throw new Error(`Unknown app state: ${state}`);
    const record = this.#record(tenantId, pluginId);
    if (!record) throw new Error(`${pluginId} is not installed`);

    // Disabling something other apps rely on would break them silently.
    if (state === "disabled") {
      const blockers = this.#activeDependents(tenantId, pluginId);
      if (blockers.length) {
        throw new Error(`${this.#manifest(pluginId).name} is used by ${blockers.map((id) => this.#manifest(id).name).join(", ")}. Turn those off first.`);
      }
    }

    record.state = state;
    record.updatedAt = new Date().toISOString();
    await this.save();
    this.#syncNavigation(tenantId);
    this.audit?.record({ action: state === ACTIVE ? "plugin.enabled" : "plugin.disabled", tenantId, pluginId });
    await this.eventBus?.emit({ type: state === ACTIVE ? "plugin.enabled" : "plugin.disabled", tenantId, pluginId });
    return record;
  }

  enable(tenantId, pluginId) { return this.setState(tenantId, pluginId, ACTIVE); }
  disable(tenantId, pluginId) { return this.setState(tenantId, pluginId, "disabled"); }

  #activeDependents(tenantId, pluginId) {
    return this.list(tenantId)
      .filter((record) => record.state !== "disabled" && record.pluginId !== pluginId)
      .filter((record) => (this.#manifest(record.pluginId).dependencies ?? []).includes(pluginId))
      .map((record) => record.pluginId);
  }

  // Uninstalling is two decisions: remove the app, and separately decide what happens to
  // the history it collected (plan section 90). Data deletion is recorded as its own
  // audit entry because it is the irreversible half.
  async uninstall(tenantId, pluginId, { keepData = true } = {}) {
    const record = this.#record(tenantId, pluginId);
    if (!record) throw new Error(`${pluginId} is not installed`);

    const dependents = this.list(tenantId)
      .filter((item) => item.pluginId !== pluginId)
      .filter((item) => (this.#manifest(item.pluginId).dependencies ?? []).includes(pluginId))
      .map((item) => item.pluginId);
    if (dependents.length) {
      throw new Error(`${this.#manifest(pluginId).name} is required by ${dependents.map((id) => this.#manifest(id).name).join(", ")}. Uninstall those first.`);
    }

    this.installations.delete(key(tenantId, pluginId));
    await this.save();
    this.#syncNavigation(tenantId);
    this.audit?.record({ action: "plugin.uninstalled", tenantId, pluginId, dataRetained: keepData });
    if (!keepData) this.audit?.record({ action: "plugin.data-deleted", tenantId, pluginId });
    await this.eventBus?.emit({ type: "plugin.uninstalled", tenantId, pluginId, keepData });
    return { pluginId, dataRetained: keepData };
  }

  async update(tenantId, pluginId) {
    const record = this.#record(tenantId, pluginId);
    if (!record) throw new Error(`${pluginId} is not installed`);
    const manifest = this.#manifest(pluginId);
    if (record.version === manifest.version) return { record, updated: false };
    const from = record.version;
    record.version = manifest.version;
    record.updatedAt = new Date().toISOString();
    await this.save();
    this.#syncNavigation(tenantId);
    this.audit?.record({ action: "plugin.updated", tenantId, pluginId, from, to: manifest.version });
    await this.eventBus?.emit({ type: "plugin.updated", tenantId, pluginId });
    return { record, updated: true, from, to: manifest.version };
  }

  // A first run installs the starter set rather than every discovered manifest.
  async ensureDefaults(tenantId, apps = DEFAULT_APPS) {
    if (this.list(tenantId).length) return this.list(tenantId);
    for (const pluginId of apps) {
      if (this.plugins?.manifestFor(pluginId)) await this.install(tenantId, pluginId);
    }
    return this.list(tenantId);
  }

  // Health is reported, never inferred as healthy: an app whose dependency is off is
  // degraded even though nothing errored (plan section 26 — do not fabricate a score).
  health(tenantId, pluginId) {
    const record = this.#record(tenantId, pluginId);
    if (!record) return { pluginId, status: "not-installed" };
    const manifest = this.#manifest(pluginId);
    const missing = (manifest.dependencies ?? []).filter((dependency) => {
      const dependencyRecord = this.#record(tenantId, dependency);
      return !dependencyRecord || dependencyRecord.state === "disabled";
    });
    if (record.state === "disabled") return { pluginId, status: "disabled", missing };
    if (missing.length) return { pluginId, status: "attention", missing, reason: `Needs ${missing.join(", ")}` };
    if (record.version !== manifest.version) return { pluginId, status: "update-available", missing, from: record.version, to: manifest.version };
    return { pluginId, status: "healthy", missing: [] };
  }
}

export { DEFAULT_APPS };
