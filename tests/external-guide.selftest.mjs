import assert from "node:assert/strict";
import { ExternalGuideSession, validateExternalGuideUrl } from "../core/runtime/index.mjs";

assert.equal(validateExternalGuideUrl("https://search.google.com/search-console"), "https://search.google.com/search-console");
assert.throws(() => validateExternalGuideUrl("https://evil.example"), /allowlisted/);
const session = new ExternalGuideSession({ matcher: { match: ({ elements }) => ({ index: elements.length ? 0 : null, confidence: elements.length ? "high" : "low" }) } });
const started = session.start({ playbookId: "search-console" });
const observed = session.observe(started.id, { goal: "settings", elements: [{ tag: "input", text: "", value: "secret-value", aria: "Settings" }] });
assert.equal(observed.elements[0].value, undefined);
assert.equal(observed.match.index, 0);
assert.equal(session.advance(started.id).step, 1);
assert.equal(session.complete(started.id).status, "completed");
console.log("external guide self-test passed");
