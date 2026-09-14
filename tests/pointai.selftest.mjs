import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLog, ElementMatcher, PlaybookCache, isSensitive, redactGoal, sanitizeElements, scoreElements } from "../core/runtime/index.mjs";

const dir = await mkdtemp(join(tmpdir(), "businessos-pointai-"));
const audit = new AuditLog();
const TENANT = "owner-1";

// A settings screen with a password field in it, as extracted from a real DOM.
const screen = [
  { i: 0, tag: "a", text: "Dashboard", href: "/home" },
  { i: 1, tag: "button", text: "Save changes" },
  { i: 2, tag: "input", type: "password", name: "current_password", placeholder: "Current password", value: "hunter2-actual-secret" },
  { i: 3, tag: "input", type: "text", name: "business_name", placeholder: "Business name", value: "ABizCreator" },
  { i: 4, tag: "button", text: "Change password" },
  { i: 5, tag: "a", text: "Connect Google Search Console", href: "/connections?provider=gsc" },
  { i: 6, tag: "input", type: "text", name: "otp", placeholder: "Enter the 6-digit code", value: "483920" },
];

// --- Sensitive fields never travel (spec section 23, criterion 15) -----------------
assert.equal(isSensitive(screen[2]), true, "a password input is sensitive");
assert.equal(isSensitive(screen[6]), true, "an OTP field is sensitive by name");
assert.equal(isSensitive(screen[3]), false, "a business name field is not sensitive");
assert.equal(isSensitive({ tag: "input", autocomplete: "one-time-code" }), true);
assert.equal(isSensitive({ tag: "input", name: "api_key" }), true);
assert.equal(isSensitive({ tag: "input", name: "cardNumber" }), true);
// "author" must not trip the auth-code pattern.
assert.equal(isSensitive({ tag: "input", name: "author" }), false);

const sanitized = sanitizeElements(screen);
// No value survives sanitizing — not for sensitive fields, not for ordinary ones.
assert.equal(sanitized.some((element) => "value" in element), false, "no element may carry a value");
assert.equal(JSON.stringify(sanitized).includes("hunter2"), false, "a password value must never appear");
assert.equal(JSON.stringify(sanitized).includes("483920"), false, "an OTP value must never appear");
assert.equal(sanitized[2].sensitive, true);
assert.match(sanitized[2].instruction, /value requested by the provider/);
assert.equal(sanitized[3].sensitive, false);

// A pasted secret in the goal itself is redacted before it is logged or sent.
assert.match(redactGoal("use token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"), /\[redacted\]/);
assert.match(redactGoal("my card is 4111111111111111"), /\[redacted\]/);
assert.equal(redactGoal("where do I change my password"), "where do I change my password");

// --- Deterministic scoring, ported from PointAI's localMatch ----------------------
const exact = scoreElements("Save changes", sanitized);
assert.equal(exact[0].i, 1);
assert.equal(exact[0].score, 1);
// Nothing on this screen is about invoices.
assert.equal(scoreElements("invoice", sanitized).length, 0);

// --- Matching tiers (spec section 52) ---------------------------------------------
// No AI configured: the deterministic tier must carry it alone.
const matcher = new ElementMatcher({ audit });

const found = await matcher.match(TENANT, { goal: "Change password", elements: screen });
assert.equal(found.index, 4);
assert.equal(found.confidence, "high");
assert.equal(found.tier, "deterministic");

// Pointing at a sensitive field is allowed; reading it is not.
const atPassword = await matcher.match(TENANT, { goal: "Current password", elements: screen });
assert.equal(atPassword.index, 2);
assert.equal(atPassword.sensitive, true);
assert.match(atPassword.instruction, /value requested by the provider/);
assert.equal(JSON.stringify(atPassword).includes("hunter2"), false);

// Low confidence does not highlight — a wrong ring is worse than no ring.
const missing = await matcher.match(TENANT, { goal: "cancel my subscription immediately", elements: screen });
assert.equal(missing.index, null);
assert.equal(missing.confidence, "low");
assert.match(missing.reasoning, /could not find/i);

await assert.rejects(() => matcher.match(TENANT, { goal: "  ", elements: screen }), /Say what you are trying to find/);

// The audit records the decision, never a value.
const entries = audit.list({ action: "pointai.match" });
assert.ok(entries.length >= 3);
assert.equal(JSON.stringify(entries).includes("hunter2"), false);
assert.equal(JSON.stringify(entries).includes("483920"), false);

// --- A model may only choose from the real list ------------------------------------
// A model that invents an index is ignored rather than followed.
const liar = new ElementMatcher({ audit, ai: { chat: async () => ({ text: "999" }) } });
const ignored = await liar.match(TENANT, { goal: "cancel my subscription immediately", elements: screen });
assert.equal(ignored.index, null, "an out-of-range model answer must not be trusted");

const helper = new ElementMatcher({ audit, ai: { chat: async () => ({ text: "5" }) } });
const assisted = await helper.match(TENANT, { goal: "hook up my google search data", elements: screen });
assert.equal(assisted.index, 5);
assert.equal(assisted.tier, "model");
assert.equal(assisted.confidence, "medium", "a model answer is never high confidence");

// A model that throws falls back to the deterministic answer rather than failing.
const broken = new ElementMatcher({ audit, ai: { chat: async () => { throw new Error("offline"); } } });
const survived = await broken.match(TENANT, { goal: "Save changes", elements: screen });
assert.equal(survived.index, 1);

// --- Playbook cache is signature-based and self-healing (spec section 28) ----------
const cache = new PlaybookCache({ stateFile: join(dir, "playbooks.json") });
await cache.load();

await cache.remember(TENANT, { host: "search.google.com", goal: "Connect Search Console", element: sanitized[5] });
const resolved = await cache.resolve(TENANT, { host: "search.google.com", goal: "connect search console!", elements: sanitized });
assert.equal(resolved.index, 5, "a remembered element re-resolves against the current DOM");
assert.equal(resolved.fromCache, true);

// Coordinates are never stored, so they can never be trusted.
assert.equal(JSON.stringify(cache.list(TENANT)).includes("top"), false);
assert.equal(JSON.stringify(cache.list(TENANT)).includes("rect"), false);

// The provider redesigns the page: the entry must delete itself, not point at nothing.
const redesigned = sanitized.filter((element) => element.i !== 5);
assert.equal(await cache.resolve(TENANT, { host: "search.google.com", goal: "Connect Search Console", elements: redesigned }), null);
assert.equal(cache.list(TENANT).length, 0, "a stale entry deletes itself");

// Tenant scoping: one company's playbooks are never served to another.
await cache.remember(TENANT, { host: "example.com", goal: "find settings", element: sanitized[1] });
assert.equal(cache.list("owner-2").length, 0);
assert.equal(await cache.resolve("owner-2", { host: "example.com", goal: "find settings", elements: sanitized }), null);

// Survives a restart.
const reloaded = new PlaybookCache({ stateFile: join(dir, "playbooks.json") });
await reloaded.load();
assert.equal(reloaded.list(TENANT).length, 1);

await rm(dir, { recursive: true, force: true });
console.log("pointai self-test passed (matching, redaction, playbook cache)");
