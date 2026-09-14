import { CapabilityRecommender } from "./capability-recommender.mjs";
import { GuideActions } from "./guide-actions.mjs";
import { listSetupPlaybooks, setupPlaybook } from "./pointai/setup-playbooks.mjs";

// The BusinessOS Guide (adopted guide spec; ruling R5 makes it core rather than a plugin).
//
// Two rules shape this file:
//
//  1. The Guide must work on a workspace with nothing installed and no AI configured —
//     that is exactly when an owner needs to be told what to install. So every answer is
//     produced deterministically first, and a model is only ever used to reword it.
//  2. Nothing a model says is executed. Actions are proposals; `GuideActions` validates
//     them before anything happens.

// Page explanations are written here rather than generated, so the description of a screen
// is stable, reviewable, and correct even offline.
const PAGE_HELP = {
  "/home": {
    title: "Home",
    what: "Your daily summary: what changed, what needs a decision from you, and what to do next.",
    can: ["See what the system did recently", "Pick up anything waiting on you"],
  },
  "/company-brain": {
    title: "Company Brain",
    what: "The verified facts about your business that every app and answer is grounded in.",
    can: ["Add a fact about how you work", "Correct something the system learned wrongly"],
  },
  "/needs-you": {
    title: "Needs You",
    what: "Work the system prepared but will not do without your approval.",
    can: ["Approve or reject a proposed action", "See exactly what would change before it happens"],
  },
  "/ask": {
    title: "Ask BusinessOS",
    what: "Ask about your business in plain language, grounded in your own data.",
    can: ["Ask what is working", "Ask what to do next"],
  },
  "/business-profile": {
    title: "Business Profile",
    what: "Your company details. Everything else builds on these, so they are worth getting right.",
    can: ["Set your trading name, location and services", "Choose how private your AI should be"],
  },
  "/tasks": {
    title: "Tasks",
    what: "Your to-do list, including work the system suggests.",
    can: ["Add a reminder", "Mark work done"],
  },
  "/apps": {
    title: "Apps & Features",
    what: "Everything installed, how it is behaving, and what else you could add.",
    can: ["Turn an app off without losing its data", "Install something new"],
  },
  "/marketplace": {
    title: "Marketplace",
    what: "Capabilities you can add to your business.",
    can: ["Add an app", "Update one you already have"],
  },
  "/connections": {
    title: "AI & Connections",
    what: "Which AI runs your work, and which of your accounts are connected.",
    can: ["Connect an account", "Choose between private and higher-quality AI"],
  },
  "/test-lab": {
    title: "Test Lab",
    what: "Try actions safely. Nothing here leaves your computer.",
    can: ["Rehearse an action before allowing it for real"],
  },
  "/activity": {
    title: "Activity",
    what: "Everything the system did, and why.",
    can: ["Check what happened and when"],
  },
  "/settings": {
    title: "Settings",
    what: "Company, safety, notifications and data.",
    can: ["Control whether anything may be published outside your computer"],
  },
};

// Words that mean "I want to do a thing" rather than "explain this screen".
const GOAL_HINTS = /\b(need|want|how do i|help me|track|manage|start|set up|setup|grow|find|get more|stop|reduce|increase)\b/i;

// "Where is the button?" is a pointing question, answered by PointAI highlighting a real
// control rather than by prose. Intent is classified here rather than in the browser so
// the panel and the Ask page cannot drift apart (spec section 7).
const POINTING_HINTS = /\b(where|which button|show me|point me|find the|can'?t find|cannot find|how do i turn|how do i change)\b/i;
const SETUP_HINTS = [{ id: "search-console", terms: /search console|google search/i }, { id: "wordpress", terms: /wordpress|staging site/i }, { id: "email", terms: /email|mailbox/i }];

export class GuideService {
  constructor({ lifecycle, tasks, ai, audit, pluginManager } = {}) {
    this.lifecycle = lifecycle;
    this.tasks = tasks;
    this.ai = ai;
    this.audit = audit;
    this.recommender = new CapabilityRecommender({ pluginManager }).build();
    this.actions = new GuideActions({ lifecycle, tasks, audit });
  }

  // The context package (spec section 32). Deliberately small: what page the owner is on,
  // what they have installed, and what is waiting on them. No page content, no field
  // values.
  context(tenantId, { route = "/home" } = {}) {
    const installed = this.lifecycle.list(tenantId);
    const page = PAGE_HELP[route] ?? null;
    const pluginRoute = route.startsWith("/apps/") ? route.split("/")[2] : null;
    const plugin = pluginRoute ? this.lifecycle.catalog(tenantId).find((app) => app.id === pluginRoute) : null;

    return {
      route,
      page: page ?? (plugin ? { title: plugin.name, what: plugin.description, can: [] } : null),
      installedApps: installed.map((record) => record.pluginId),
      needsSetup: this.lifecycle.catalog(tenantId)
        .filter((app) => app.installed && app.health?.status === "attention")
        .map((app) => app.id),
      openTasks: this.tasks?.list(tenantId, { status: "open" }).length ?? 0,
    };
  }

  // Suggestions must be evidence-backed and never "recommend a plugin because it exists"
  // (spec section 35). Each one names the observation that produced it.
  suggestions(tenantId) {
    const out = [];
    const catalog = this.lifecycle.catalog(tenantId);

    for (const app of catalog) {
      if (!app.installed) continue;
      const health = this.lifecycle.health(tenantId, app.id);
      if (health.status === "attention") {
        out.push({
          id: `setup:${app.id}`,
          text: `${app.name} needs ${health.missing.join(", ")} turned on before it can work.`,
          evidence: `dependency ${health.missing.join(", ")} is off`,
          action: { type: "navigation.open", route: "/apps" },
        });
      }
      if (app.updateAvailable) {
        out.push({
          id: `update:${app.id}`,
          text: `${app.name} has an update available.`,
          evidence: `installed ${app.installedVersion}, available ${app.version}`,
          action: { type: "navigation.open", route: `/apps/${app.id}` },
        });
      }
    }

    return out;
  }

  explainPage(tenantId, route) {
    const context = this.context(tenantId, { route });
    if (!context.page) {
      return { route, known: false, text: "This screen does not have a description yet." };
    }
    return {
      route,
      known: true,
      title: context.page.title,
      text: context.page.what,
      canDo: context.page.can,
    };
  }

  // A goal produces a recommendation from the capability index. The model is offered the
  // matched terms and asked to reword — it is never asked which app to choose, and if it
  // is unavailable or answers badly the deterministic sentence is what the owner sees.
  async recommend(tenantId, goal) {
    const installedIds = this.lifecycle.list(tenantId).map((record) => record.pluginId);
    const result = this.recommender.recommend(goal, { installedIds });
    this.audit?.record({ action: "guide.recommendation", tenantId, goal, pluginId: result.recommended_plugin });

    if (!result.recommended_plugin) return { ...result, explanation: result.reason };

    const explanation = await this.#explain(goal, result);
    return { ...result, explanation };
  }

  async #explain(goal, result) {
    const deterministic = result.already_installed
      ? `You already have ${result.recommended_name}. It handles ${result.matched_terms.slice(0, 3).join(", ")}.`
      : `${result.recommended_name} is the closest match — it covers ${result.matched_terms.slice(0, 3).join(", ")}.`;

    if (!this.ai) return deterministic;
    try {
      const status = await this.ai.status?.();
      if (status && status.ollama && status.ollama.available === false) return deterministic;
      const answer = await this.ai.chat({
        prompt: `A small business owner said: "${goal}". The system has already chosen ${result.recommended_name} because it covers: ${result.matched_terms.join(", ")}. Write one plain sentence telling the owner why this app fits. Do not suggest a different app. Do not mention capabilities, manifests or matching.`,
      });
      const text = String(answer?.text ?? "").trim();
      // A model that rambles or goes off-topic loses to the deterministic sentence.
      return text && text.length < 400 ? text : deterministic;
    } catch {
      return deterministic;
    }
  }

  // Single entry point for the panel and the Ask page — spec section 7 requires both to
  // share one backend.
  async message(tenantId, { text, route = "/home" } = {}) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) throw new Error("Ask a question first");
    this.audit?.record({ action: "guide.message", tenantId, route });

    const asksAboutPage = /\b(this page|this screen|where am i|what is this|what does this do)\b/i.test(trimmed);
    if (asksAboutPage) {
      const explained = this.explainPage(tenantId, route);
      return {
        kind: "page-help",
        text: explained.known ? `${explained.title}: ${explained.text}` : explained.text,
        canDo: explained.canDo ?? [],
        actions: [],
      };
    }

    if (POINTING_HINTS.test(trimmed)) {
      return { kind: "point", goal: trimmed, text: "Let me show you where.", actions: [] };
    }

    const setup = SETUP_HINTS.find((item) => item.terms.test(trimmed));
    if (setup && /connect|setup|set up|configure|guide|help/i.test(trimmed)) {
      const playbook = setupPlaybook(setup.id);
      return { kind: "setup", text: `${playbook.title}. I will guide you one step at a time. PointAI does not read or store credentials.`, setup: playbook, actions: playbook.url ? [{ type: "external.open", url: playbook.url, label: `Open ${playbook.host}` }] : [] };
    }

    if (GOAL_HINTS.test(trimmed) || this.recommender.score(trimmed).length > 0) {
      const result = await this.recommend(tenantId, trimmed);
      if (result.recommended_plugin) {
        const actions = result.already_installed
          ? [{ type: "navigation.open", route: `/apps/${result.recommended_plugin}`, label: `Open ${result.recommended_name}` }]
          : [{ type: "plugin.install", plugin_id: result.recommended_plugin, label: `Add ${result.recommended_name}` }];
        return { kind: "recommendation", text: result.explanation, recommendation: result, actions };
      }
    }

    const context = this.context(tenantId, { route });
    return {
      kind: "fallback",
      text: context.page
        ? `I can explain this screen or help you find the right app. ${context.page.title}: ${context.page.what}`
        : "I can explain a screen, help you find the right app, or add a reminder.",
      actions: [],
    };
  }
}

export { PAGE_HELP };
