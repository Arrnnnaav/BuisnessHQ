// Guide action validation (adopted guide spec sections 39, 40, 62).
//
// "The Guide should never directly mutate arbitrary data from free-form model output."
// Everything a model can propose passes through here first. An action that is not in this
// table does not execute, and a route the navigation registry does not know is not opened
// — the model proposes a target, core decides whether it exists.

const ACTION_TYPES = new Set(["navigation.open", "plugin.install", "tasks.create"]);

export class GuideActions {
  constructor({ lifecycle, tasks, audit } = {}) {
    this.lifecycle = lifecycle;
    this.tasks = tasks;
    this.audit = audit;
  }

  // Routes come from the registry, so this cannot drift from what the sidebar renders.
  #knownRoutes(tenantId) {
    const tree = this.lifecycle.navigationFor(tenantId).tree();
    return new Set([...tree.core, ...tree.plugins, ...tree.platform].map((item) => item.route));
  }

  validate(tenantId, action) {
    if (!action || typeof action !== "object") throw new Error("An action object is required");
    if (!ACTION_TYPES.has(action.type)) throw new Error(`The Guide cannot perform '${action.type}'`);

    if (action.type === "navigation.open") {
      const route = String(action.route ?? "");
      if (!this.#knownRoutes(tenantId).has(route)) throw new Error(`Unknown route: ${route}`);
      return { type: action.type, route };
    }

    if (action.type === "plugin.install") {
      const pluginId = String(action.plugin_id ?? "");
      const known = this.lifecycle.catalog(tenantId).some((app) => app.id === pluginId);
      if (!known) throw new Error(`Unknown app: ${pluginId}`);
      return { type: action.type, plugin_id: pluginId };
    }

    const title = String(action.title ?? "").trim();
    if (!title) throw new Error("A task needs a title");
    return { type: action.type, title, due_at: action.due_at ?? null };
  }

  // Executing an install goes through the normal lifecycle (spec section 41): the Guide
  // gets no shortcut that skips dependency checks, audit or navigation registration.
  async execute(tenantId, action) {
    const safe = this.validate(tenantId, action);
    this.audit?.record({ action: "guide.action", tenantId, actionType: safe.type, target: safe.route ?? safe.plugin_id ?? safe.title });

    if (safe.type === "navigation.open") return { performed: safe.type, route: safe.route };
    if (safe.type === "plugin.install") {
      const result = await this.lifecycle.install(tenantId, safe.plugin_id);
      return { performed: safe.type, plugin_id: safe.plugin_id, broughtIn: result.broughtIn, alreadyInstalled: result.alreadyInstalled, route: `/apps/${safe.plugin_id}` };
    }
    const task = await this.tasks.create(tenantId, { title: safe.title, dueAt: safe.due_at, source: "guide" });
    return { performed: safe.type, task };
  }
}

export { ACTION_TYPES };
