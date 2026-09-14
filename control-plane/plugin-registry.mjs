import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { checksum, signPackage, verifyPackage } from "./package-signing.mjs";

// The plugin registry (ruling R6, section 5 of the operator plan).
//
// This is the piece that turns a Marketplace into a distribution system: plugins have
// versions, versions live on release channels, and a version can be blocked centrally when
// it turns out to be broken.
//
// Two rules run through it:
//  - A version is immutable once published. Fixing a bad release means publishing another
//    version, never editing one clients may already have installed.
//  - A block controls a *known platform state*. It stops a version being offered or
//    installed. It cannot make a client execute anything.

export const CHANNELS = ["development", "alpha", "beta", "stable"];

// A client on a given channel accepts releases from that channel and everything more
// stable, so a beta tester still gets stable releases.
const CHANNEL_RANK = Object.fromEntries(CHANNELS.map((channel, index) => [channel, index]));
const accepts = (clientChannel, releaseChannel) =>
  CHANNEL_RANK[releaseChannel] >= CHANNEL_RANK[clientChannel ?? "stable"];

const compareVersions = (left, right) => {
  const a = String(left).split(".").map(Number);
  const b = String(right).split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
};

export class PluginRegistry {
  constructor({ stateFile, signingKeys } = {}) {
    this.stateFile = stateFile;
    this.signingKeys = signingKeys ?? null;
    this.plugins = new Map();
    this.versions = new Map();   // `${pluginId}@${version}` -> record
    this.rollouts = new Map();   // `${pluginId}@${version}` -> rollout
  }

  async load() {
    if (!this.stateFile) return this;
    await mkdir(dirname(this.stateFile), { recursive: true });
    try {
      const state = JSON.parse(await readFile(this.stateFile, "utf8"));
      for (const plugin of state.plugins ?? []) this.plugins.set(plugin.id, plugin);
      for (const version of state.versions ?? []) this.versions.set(`${version.pluginId}@${version.version}`, version);
      for (const rollout of state.rollouts ?? []) this.rollouts.set(`${rollout.pluginId}@${rollout.version}`, rollout);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    return this;
  }

  async save() {
    if (!this.stateFile) return;
    await writeFile(this.stateFile, JSON.stringify({
      plugins: [...this.plugins.values()],
      versions: [...this.versions.values()],
      rollouts: [...this.rollouts.values()],
    }, null, 2));
  }

  // ---- Catalogue ------------------------------------------------------------------

  async registerPlugin({ id, name, description, category, publisher = "BusinessOS", visibility = "public", tenants = [], requiredPlan = null }) {
    if (!id || !name) throw new Error("A plugin needs an id and a name");
    const existing = this.plugins.get(id);
    const plugin = {
      id, name, description: description ?? "", category: category ?? "uncategorized",
      publisher, status: existing?.status ?? "draft",
      // A private plugin is visible only to the tenants named here — the mechanism for
      // custom client work.
      visibility, tenants, requiredPlan,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    this.plugins.set(id, plugin);
    await this.save();
    return plugin;
  }

  // ---- Versions -------------------------------------------------------------------

  async publishVersion({ pluginId, version, files, channel = "development", minimumCoreVersion = "0.1.0", dependencies = [], permissions = [], capabilities = [], notes = "" }) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Unknown plugin: ${pluginId}`);
    if (!CHANNELS.includes(channel)) throw new Error(`Unknown release channel: ${channel}`);
    if (!/^\d+\.\d+\.\d+$/.test(String(version))) throw new Error("A version must look like 1.2.3");

    const key = `${pluginId}@${version}`;
    // Immutability is the guarantee that a checksum a client verified yesterday still
    // means the same bytes today.
    if (this.versions.has(key)) throw new Error(`${pluginId} ${version} is already published. Publish a new version instead.`);

    const signed = this.signingKeys
      ? signPackage({ pluginId, version, files, privateKey: this.signingKeys.privateKey })
      : { checksum: checksum(files), signature: null };

    const record = {
      pluginId, version, channel, minimumCoreVersion, dependencies, permissions, capabilities, notes,
      files, checksum: signed.checksum, signature: signed.signature,
      blocked: false, blockedReason: null, critical: false,
      publishedAt: new Date().toISOString(),
    };
    this.versions.set(key, record);
    plugin.status = "published";
    await this.save();
    return record;
  }

  // Promotion moves an existing version to a wider channel without republishing it, so the
  // bytes that were tested on beta are the bytes that reach stable.
  async promote(pluginId, version, channel) {
    if (!CHANNELS.includes(channel)) throw new Error(`Unknown release channel: ${channel}`);
    const record = this.versions.get(`${pluginId}@${version}`);
    if (!record) throw new Error(`${pluginId} ${version} is not published`);
    record.channel = channel;
    await this.save();
    return record;
  }

  // ---- Kill switches ---------------------------------------------------------------
  // Known platform states only (ruling R6). Blocking stops a version being offered or
  // installed; it never makes a client run anything.

  async blockVersion(pluginId, version, reason) {
    const record = this.versions.get(`${pluginId}@${version}`);
    if (!record) throw new Error(`${pluginId} ${version} is not published`);
    if (!reason) throw new Error("Blocking a version requires a reason");
    record.blocked = true;
    record.blockedReason = reason;
    await this.save();
    return record;
  }

  async unblockVersion(pluginId, version) {
    const record = this.versions.get(`${pluginId}@${version}`);
    if (!record) throw new Error(`${pluginId} ${version} is not published`);
    record.blocked = false; record.blockedReason = null;
    await this.save();
    return record;
  }

  async markCritical(pluginId, version, critical = true) {
    const record = this.versions.get(`${pluginId}@${version}`);
    if (!record) throw new Error(`${pluginId} ${version} is not published`);
    record.critical = critical;
    await this.save();
    return record;
  }

  // ---- Staged rollout ----------------------------------------------------------------

  async startRollout({ pluginId, version, stages = [{ percent: 100 }] }) {
    const record = this.versions.get(`${pluginId}@${version}`);
    if (!record) throw new Error(`${pluginId} ${version} is not published`);
    const rollout = {
      pluginId, version, stages, stageIndex: 0, paused: false,
      startedAt: new Date().toISOString(),
    };
    this.rollouts.set(`${pluginId}@${version}`, rollout);
    await this.save();
    return rollout;
  }

  async advanceRollout(pluginId, version) {
    const rollout = this.rollouts.get(`${pluginId}@${version}`);
    if (!rollout) throw new Error("No rollout in progress");
    rollout.stageIndex = Math.min(rollout.stageIndex + 1, rollout.stages.length - 1);
    await this.save();
    return rollout;
  }

  async pauseRollout(pluginId, version, paused = true) {
    const rollout = this.rollouts.get(`${pluginId}@${version}`);
    if (!rollout) throw new Error("No rollout in progress");
    rollout.paused = paused;
    await this.save();
    return rollout;
  }

  // Deterministic per tenant, so a company does not flip in and out of a rollout as the
  // percentage is recalculated. Same tenant and version always land in the same bucket.
  #inRollout(rollout, tenantId) {
    if (!rollout) return true;
    if (rollout.paused) return false;
    const stage = rollout.stages[rollout.stageIndex] ?? { percent: 100 };
    if (Array.isArray(stage.tenants) && stage.tenants.length) return stage.tenants.includes(tenantId);
    if (typeof stage.percent !== "number") return true;
    const bucket = Number(BigInt(`0x${checksum(`${rollout.pluginId}@${rollout.version}:${tenantId}`).slice(0, 8)}`) % 100n);
    return bucket < stage.percent;
  }

  // ---- What a client may see and install -----------------------------------------------

  #visibleTo(plugin, { tenantId, plan, entitlements = [] }) {
    if (plugin.visibility === "private") return plugin.tenants.includes(tenantId);
    if (plugin.requiredPlan && plugin.requiredPlan !== plan && !entitlements.includes(plugin.id)) {
      // Still listed, so the owner can see it exists and what it needs — but not installable.
      return true;
    }
    return true;
  }

  resolveVersion(pluginId, { channel = "stable", coreVersion = "99.0.0", tenantId = "" } = {}) {
    const candidates = [...this.versions.values()]
      .filter((record) => record.pluginId === pluginId)
      .filter((record) => !record.blocked)
      .filter((record) => accepts(channel, record.channel))
      .filter((record) => compareVersions(coreVersion, record.minimumCoreVersion) >= 0)
      .filter((record) => this.#inRollout(this.rollouts.get(`${record.pluginId}@${record.version}`), tenantId))
      .sort((left, right) => compareVersions(right.version, left.version));
    return candidates[0] ?? null;
  }

  // The catalogue as one installation sees it: only what it is allowed to see, at the
  // version it is allowed to get.
  catalog({ tenantId, channel = "stable", coreVersion = "99.0.0", plan = "free", entitlements = [], installed = [] } = {}) {
    const installedMap = new Map(installed.map((item) => [item.id, item.version]));
    return [...this.plugins.values()]
      .filter((plugin) => plugin.status === "published")
      .filter((plugin) => this.#visibleTo(plugin, { tenantId, plan, entitlements }))
      .map((plugin) => {
        const release = this.resolveVersion(plugin.id, { channel, coreVersion, tenantId });
        const installedVersion = installedMap.get(plugin.id) ?? null;
        return {
          id: plugin.id, name: plugin.name, description: plugin.description,
          category: plugin.category, publisher: plugin.publisher,
          requiredPlan: plugin.requiredPlan,
          entitled: !plugin.requiredPlan || plugin.requiredPlan === plan || entitlements.includes(plugin.id),
          latestVersion: release?.version ?? null,
          channel: release?.channel ?? null,
          permissions: release?.permissions ?? [],
          dependencies: release?.dependencies ?? [],
          critical: Boolean(release?.critical),
          installed: Boolean(installedVersion),
          installedVersion,
          updateAvailable: Boolean(installedVersion && release && compareVersions(release.version, installedVersion) > 0),
          available: Boolean(release),
        };
      })
      .filter((entry) => entry.available || entry.installed);
  }

  // What a client downloads. Every refusal names its reason so the client can say why.
  download(pluginId, { version, tenantId, channel = "stable", coreVersion = "99.0.0", plan = "free", entitlements = [], installedIds = [] } = {}) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Unknown app: ${pluginId}`);
    if (plugin.visibility === "private" && !plugin.tenants.includes(tenantId)) throw new Error(`Unknown app: ${pluginId}`);
    if (plugin.requiredPlan && plugin.requiredPlan !== plan && !entitlements.includes(pluginId)) {
      throw new Error(`${plugin.name} needs the ${plugin.requiredPlan} plan.`);
    }

    const record = version ? this.versions.get(`${pluginId}@${version}`) : this.resolveVersion(pluginId, { channel, coreVersion, tenantId });
    if (!record) throw new Error(`No release of ${plugin.name} is available for this installation.`);
    if (record.blocked) throw new Error(`${plugin.name} ${record.version} was withdrawn: ${record.blockedReason}`);
    if (compareVersions(coreVersion, record.minimumCoreVersion) < 0) {
      throw new Error(`${plugin.name} ${record.version} needs BusinessOS ${record.minimumCoreVersion} or newer.`);
    }

    const missing = (record.dependencies ?? []).filter((dependency) => !installedIds.includes(dependency) && !this.plugins.has(dependency));
    if (missing.length) throw new Error(`${plugin.name} needs ${missing.join(", ")}, which is not available.`);

    return {
      pluginId, version: record.version, files: record.files,
      checksum: record.checksum, signature: record.signature,
      minimumCoreVersion: record.minimumCoreVersion,
      dependencies: record.dependencies, permissions: record.permissions,
      publicKey: this.signingKeys?.publicKey ?? null,
    };
  }

  verify(bundle) {
    return verifyPackage({ ...bundle, publicKey: bundle.publicKey ?? this.signingKeys?.publicKey });
  }

  listVersions(pluginId) {
    return [...this.versions.values()]
      .filter((record) => !pluginId || record.pluginId === pluginId)
      .sort((left, right) => compareVersions(right.version, left.version));
  }

  list() { return [...this.plugins.values()]; }
}

export { compareVersions, accepts };
