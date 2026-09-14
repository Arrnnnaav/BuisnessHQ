// Owner-facing navigation. Three fixed sections (GrowthOS plan section 10/39/40):
// CORE is always present, GROWTH APPS is whatever the owner installed, PLATFORM is
// the management surface. Plugins never write to this directly; the registry derives
// their entries from the manifest so a plugin cannot invent a core nav item.

const CORE = [
  { id: "home", title: "Home", icon: "⌂", route: "/home" },
  { id: "company-brain", title: "Company Brain", icon: "◈", route: "/company-brain" },
  { id: "needs-you", title: "Needs You", icon: "!", route: "/needs-you", badge: "approvals" },
  { id: "ask", title: "Ask BusinessOS", icon: "✦", route: "/ask" },
  { id: "business-profile", title: "Business Profile", icon: "◎", route: "/business-profile" },
  { id: "tasks", title: "Tasks", icon: "✓", route: "/tasks", badge: "tasksDue" },
];

const PLATFORM = [
  { id: "apps", title: "Apps & Features", icon: "✦", route: "/apps" },
  { id: "marketplace", title: "Marketplace", icon: "＋", route: "/marketplace" },
  { id: "connections", title: "AI & Connections", icon: "⚙", route: "/connections" },
  { id: "test-lab", title: "Test Lab", icon: "⌁", route: "/test-lab" },
  { id: "activity", title: "Activity", icon: "◷", route: "/activity" },
  { id: "settings", title: "Settings", icon: "⚙", route: "/settings" },
];

// Section 47. `installed` means present but not yet usable; `configured` adds setup
// complete; `enabled` adds the owner switching it on. Only `enabled` renders as an
// active nav entry, and `disabled` stays visible-but-dimmed so the owner can find it
// again (section 9: disable keeps code and data).
const VISIBLE_STATES = new Set(["enabled", "disabled", "installed", "configured"]);
const ACTIVE_STATES = new Set(["enabled"]);

const FALLBACK_ICON = "▦";

// Used when a plugin declares no icon, or declares an asset path that is not shipped.
const CATEGORY_ICONS = { growth: "✦", business: "▦", intelligence: "◈", operations: "⚙" };

export class NavigationRegistry {
  constructor({ audit, eventBus, iconExists } = {}) {
    this.iconExists = iconExists;
    this.audit = audit;
    this.eventBus = eventBus;
    this.entries = new Map();
    this.sequence = 0;
  }

  // Newly installed apps append to the BOTTOM of Growth Apps (section 10), so order is
  // install order, not alphabetical and not manifest order.
  // A manifest may point at an icon file that was never shipped. Requesting it produces a
  // 404 on every page load and still falls back in the UI, so an unresolvable path is
  // turned into a category glyph here instead of being sent to the browser.
  #icon(manifest, ui) {
    const declared = manifest.assets?.icon ?? ui.icon ?? null;
    const isPath = typeof declared === "string" && (declared.startsWith("/") || declared.startsWith("http"));
    if (!declared) return CATEGORY_ICONS[manifest.category] ?? FALLBACK_ICON;
    if (!isPath) return declared;
    if (this.iconExists?.(declared)) return declared;
    return CATEGORY_ICONS[manifest.category] ?? FALLBACK_ICON;
  }

  register(manifest, { state = "installed" } = {}) {
    if (!manifest?.id) throw new Error("Navigation registration requires a plugin id");
    if (CORE.some((item) => item.id === manifest.id) || PLATFORM.some((item) => item.id === manifest.id)) {
      throw new Error(`Plugin '${manifest.id}' may not claim a reserved navigation id`);
    }
    const ui = manifest.businessos?.ui ?? {};
    if (ui.navigationItem === false) return null;
    const existing = this.entries.get(manifest.id);
    const entry = {
      id: manifest.id,
      title: manifest.name ?? manifest.id,
      icon: this.#icon(manifest, ui),
      route: `/apps/${manifest.id}`,
      category: manifest.category ?? "uncategorized",
      version: manifest.version ?? null,
      state,
      order: existing?.order ?? (this.sequence += 1),
    };
    this.entries.set(manifest.id, entry);
    this.audit?.record({ action: "navigation.registered", pluginId: manifest.id, state });
    return entry;
  }

  unregister(id) {
    if (!this.entries.delete(id)) return false;
    this.audit?.record({ action: "navigation.unregistered", pluginId: id });
    return true;
  }

  setState(id, state) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown navigation entry: ${id}`);
    entry.state = state;
    this.audit?.record({ action: "navigation.state_changed", pluginId: id, state });
    return entry;
  }

  show(id) { return this.setState(id, "enabled"); }
  hide(id) { return this.setState(id, "disabled"); }

  // Mirrors plugin lifecycle events so navigation cannot drift from plugin state.
  attach(eventBus = this.eventBus, pluginManager) {
    if (!eventBus) return this;
    eventBus.on("plugin.enabled", ({ pluginId }) => { if (this.entries.has(pluginId)) this.show(pluginId); });
    eventBus.on("plugin.disabled", ({ pluginId }) => { if (this.entries.has(pluginId)) this.hide(pluginId); });
    eventBus.on("plugin.uninstalled", ({ pluginId }) => this.unregister(pluginId));
    eventBus.on("plugin.installed", ({ pluginId }) => {
      const manifest = pluginManager?.manifestFor?.(pluginId);
      if (manifest) this.register(manifest, { state: "installed" });
    });
    return this;
  }

  growthApps({ includeHidden = true } = {}) {
    return [...this.entries.values()]
      .filter((entry) => (includeHidden ? VISIBLE_STATES : ACTIVE_STATES).has(entry.state))
      .sort((left, right) => left.order - right.order)
      .map((entry) => ({ ...entry, active: ACTIVE_STATES.has(entry.state) }));
  }

  // The shape the sidebar renders. Sections are fixed; only `plugins` varies.
  tree(options = {}) {
    return { core: [...CORE], plugins: this.growthApps(options), platform: [...PLATFORM] };
  }

  routeFor(id) {
    return this.entries.get(id)?.route ?? CORE.concat(PLATFORM).find((item) => item.id === id)?.route ?? null;
  }
}

export { CORE as CORE_NAVIGATION, PLATFORM as PLATFORM_NAVIGATION };
