import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { AuditLog, GuideService, PluginLifecycle, PluginManager, TaskStore } from "../core/runtime/index.mjs";

const dir = await mkdtemp(join(tmpdir(), "businessos-guide-"));
const audit = new AuditLog();
const plugins = new PluginManager({ root: resolve("plugins") });
await plugins.discover();

const lifecycle = new PluginLifecycle({ stateFile: join(dir, "installations.json"), pluginManager: plugins, audit });
await lifecycle.load();
const tasks = new TaskStore({ stateFile: join(dir, "tasks.json") });
await tasks.load();

const TENANT = "owner-1";
await lifecycle.ensureDefaults(TENANT);

// No AI is passed: the Guide must work fully on a machine with nothing configured.
const guide = new GuideService({ lifecycle, tasks, audit, pluginManager: plugins });

// --- Recommendation is deterministic (spec section 11) -----------------------------
// The capability index decides; a model only rewords. Same goal, same answer, every time.
const crm = await guide.recommend(TENANT, "I need to keep track of customer follow-ups");
assert.equal(crm.recommended_plugin, "crm");
assert.equal(crm.already_installed, false);
assert.ok(crm.required_capabilities.length > 0, "recommendation should cite declared capabilities");
const again = await guide.recommend(TENANT, "I need to keep track of customer follow-ups");
assert.deepEqual(again.recommended_plugin, crm.recommended_plugin);

// Goals an owner would actually type, in their words rather than the manifest's.
const cases = [
  ["I want to send quotes to customers", "quotations"],
  ["help me show up on google", "seo"],
  ["what should I charge for brochures", "pricing"],
  ["I need to reply to bad reviews", "reviews"],
  ["post to instagram every week", "social"],
];
for (const [goal, expected] of cases) {
  const result = await guide.recommend(TENANT, goal);
  assert.equal(result.recommended_plugin, expected, `"${goal}" should recommend ${expected}, got ${result.recommended_plugin}`);
}

// An app the owner already has is not re-recommended as an install.
const owned = await guide.recommend(TENANT, "manage my product catalog and services");
assert.equal(owned.recommended_plugin, "catalog");
assert.equal(owned.already_installed, true);

// A goal nothing covers gets an honest "no", not a nearest guess.
const nothing = await guide.recommend(TENANT, "xyzzy plugh quuxbaz");
assert.equal(nothing.recommended_plugin, null);
assert.match(nothing.reason, /No installed or available app/);

// --- Actions are validated, never trusted (spec sections 39, 40, 62) ---------------
const actions = guide.actions;
assert.deepEqual(actions.validate(TENANT, { type: "navigation.open", route: "/tasks" }), { type: "navigation.open", route: "/tasks" });
// A route the registry does not know is refused even though it looks plausible.
assert.throws(() => actions.validate(TENANT, { type: "navigation.open", route: "/admin" }), /Unknown route/);
assert.throws(() => actions.validate(TENANT, { type: "navigation.open", route: "/apps/crm" }), /Unknown route/);
assert.throws(() => actions.validate(TENANT, { type: "plugin.install", plugin_id: "not-real" }), /Unknown app/);
assert.throws(() => actions.validate(TENANT, { type: "sql.execute", query: "drop table" }), /cannot perform/);
assert.throws(() => actions.validate(TENANT, { type: "tasks.create", title: "   " }), /needs a title/);

// Installing through the Guide goes through the real lifecycle (spec section 41).
const installed = await actions.execute(TENANT, { type: "plugin.install", plugin_id: "crm" });
assert.equal(installed.plugin_id, "crm");
assert.equal(lifecycle.navigationFor(TENANT).tree().plugins.at(-1).id, "crm", "installed app lands at the bottom of Growth Apps");
// Once installed, its route becomes navigable — the route table follows real state.
assert.deepEqual(actions.validate(TENANT, { type: "navigation.open", route: "/apps/crm" }), { type: "navigation.open", route: "/apps/crm" });

// Tasks are core, and record what put them on the list.
const created = await actions.execute(TENANT, { type: "tasks.create", title: "Call the paper supplier" });
assert.equal(created.task.title, "Call the paper supplier");
assert.equal(created.task.source, "guide");
assert.equal(tasks.list(TENANT, { status: "open" }).length, 1);

// --- Page help and context (spec sections 9, 32) -----------------------------------
const explained = guide.explainPage(TENANT, "/needs-you");
assert.equal(explained.known, true);
assert.match(explained.text, /approval/i);
assert.equal(guide.explainPage(TENANT, "/nowhere").known, false);

const context = guide.context(TENANT, { route: "/apps/seo" });
assert.equal(context.route, "/apps/seo");
assert.equal(context.page.title, "SEO Intelligence Suite", "a plugin route describes the plugin");
assert.ok(context.installedApps.includes("seo"));
assert.equal(context.openTasks, 1);

// --- One backend for the panel and the Ask page (spec section 7) -------------------
const pageQuestion = await guide.message(TENANT, { text: "what is this page?", route: "/company-brain" });
assert.equal(pageQuestion.kind, "page-help");
assert.match(pageQuestion.text, /Company Brain/);

const goalMessage = await guide.message(TENANT, { text: "I need to send proposals", route: "/home" });
assert.equal(goalMessage.kind, "recommendation");
assert.equal(goalMessage.recommendation.recommended_plugin, "quotations");
assert.equal(goalMessage.actions[0].type, "plugin.install");

// An already-installed match offers to open it rather than install it again.
const openMessage = await guide.message(TENANT, { text: "I want to manage my product catalog", route: "/home" });
assert.equal(openMessage.actions[0].type, "navigation.open");
assert.equal(openMessage.actions[0].route, "/apps/catalog");
const setupMessage = await guide.message(TENANT, { text: "help me connect Search Console", route: "/connections" });
assert.equal(setupMessage.kind, "setup");
assert.equal(setupMessage.setup.url, "https://search.google.com/search-console");
assert.ok(setupMessage.setup.steps.every((step) => !/(password|secret|token)\s*[:=]\s*\S+/i.test(JSON.stringify(step))));

// A "where is it" question is a pointing question: the answer is a highlight, not prose.
// Classified on the server so the panel and the Ask page cannot drift apart.
const pointing = await guide.message(TENANT, { text: "where do I turn off an app", route: "/apps" });
assert.equal(pointing.kind, "point");
assert.equal(pointing.goal, "where do I turn off an app");
for (const phrase of ["show me the save button", "which button cancels this", "I can't find the settings"]) {
  assert.equal((await guide.message(TENANT, { text: phrase, route: "/apps" })).kind, "point", phrase);
}
// "Where am I" is about the page, not a control, so it stays page help.
assert.equal((await guide.message(TENANT, { text: "where am i?", route: "/apps" })).kind, "page-help");

await assert.rejects(() => guide.message(TENANT, { text: "   " }), /Ask a question first/);

// --- Suggestions are evidence-backed (spec section 35) -----------------------------
// Nothing is wrong yet, so nothing is suggested. "Recommend because it exists" is exactly
// what the spec forbids.
assert.deepEqual(guide.suggestions(TENANT), []);
await lifecycle.disable(TENANT, "pricing");
await lifecycle.disable(TENANT, "catalog");
await lifecycle.enable(TENANT, "pricing");
const suggestions = guide.suggestions(TENANT);
assert.ok(suggestions.length > 0, "a broken dependency should produce a suggestion");
assert.ok(suggestions.every((item) => item.evidence), "every suggestion names its evidence");
assert.match(suggestions.find((item) => item.id === "setup:pricing").text, /catalog/);

// Guide activity is attributable (spec section 49).
assert.ok(audit.list({ action: "guide.recommendation" }).length > 0);
assert.ok(audit.list({ action: "guide.action" }).length > 0);

await rm(dir, { recursive: true, force: true });
console.log(`guide self-test passed (${guide.recommender.index.size} apps indexed)`);
