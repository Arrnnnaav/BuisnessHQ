// PointAI element matching.
//
// Ported from the standalone PointAI project (`frontend/src/lib/matcher.js`, `localMatch`)
// and moved server-side so the same tiering, thresholds and audit apply everywhere.
//
// Changes made during the port:
//  - The original returned only "confident" or nothing. The adopted spec (section 52) asks
//    for three tiers, so a medium band now exists that offers a candidate for the owner to
//    confirm rather than silently highlighting it.
//  - Element values never arrive here; `sensitive-fields.mjs` has already stripped them.
//  - The model is a fallback, never the first resort, and its answer is validated against
//    the element list rather than trusted.

import { redactGoal, sanitizeElements } from "./sensitive-fields.mjs";

// Tuned so an exact label match lands in "high" and a couple of shared words does not.
export const THRESHOLDS = { high: 0.75, medium: 0.45 };

const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "my", "me", "i", "click", "button", "where", "how", "do", "is", "it"]);

const tokens = (text) =>
  String(text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP.has(word));

const haystack = (element) =>
  `${element.text ?? ""} ${element.aria ?? ""} ${element.placeholder ?? ""} ${element.label ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Deterministic tier. This is the original localMatch logic, scored 0..1 so it can be
// banded rather than returning a bare "confident".
export function scoreElements(goal, elements) {
  const wanted = String(goal ?? "").toLowerCase().trim();
  const wantedTokens = tokens(wanted);
  const scored = [];

  for (const element of elements) {
    const hay = haystack(element);
    if (!hay) continue;

    let score = 0;
    if (hay === wanted || String(element.text ?? "").toLowerCase() === wanted || String(element.aria ?? "").toLowerCase() === wanted) {
      score = 1;
    } else if (wanted && hay.includes(wanted)) {
      score = 0.9;
    } else if (wantedTokens.length) {
      const hit = wantedTokens.filter((token) => hay.includes(token)).length;
      score = hit / wantedTokens.length;
      // A short label that matches every word is a better answer than a long one that
      // happens to contain them, so mild preference for concise targets.
      if (score === 1 && hay.length > 60) score = 0.85;
    }

    if (score > 0) scored.push({ ...element, score });
  }

  return scored.sort((left, right) => right.score - left.score || left.i - right.i);
}

export function band(score) {
  if (score >= THRESHOLDS.high) return "high";
  if (score >= THRESHOLDS.medium) return "medium";
  return "low";
}

export class ElementMatcher {
  constructor({ ai, audit } = {}) {
    this.ai = ai;
    this.audit = audit;
  }

  // `elements` is the compact list the browser extracted. It is sanitized again here
  // rather than trusting the caller to have done it.
  async match(tenantId, { goal, elements = [], host = "internal" } = {}) {
    const safeElements = sanitizeElements(elements);
    const safeGoal = redactGoal(goal);
    if (!safeGoal.trim()) throw new Error("Say what you are trying to find");

    const ranked = scoreElements(safeGoal, safeElements);
    const best = ranked[0];

    const record = (result) => {
      // The audit records the decision, never a field value (criterion 15).
      this.audit?.record({
        action: "pointai.match", tenantId, host, goal: safeGoal,
        confidence: result.confidence, matchedIndex: result.index ?? null, tier: result.tier,
      });
      return result;
    };

    if (best && band(best.score) === "high") {
      return record({
        index: best.i, confidence: "high", tier: "deterministic",
        element: best, reasoning: `Matched the label "${best.text || best.aria}".`,
        sensitive: Boolean(best.sensitive),
        instruction: best.sensitive ? best.instruction : null,
      });
    }

    // Medium and low both get a model attempt when one is available, because this is
    // exactly where wording differs from the label ("turn off emails" vs "Unsubscribe").
    const assisted = await this.#askModel(safeGoal, safeElements);
    if (assisted) return record(assisted);

    if (best && band(best.score) === "medium") {
      return record({
        index: best.i, confidence: "medium", tier: "deterministic",
        element: best, reasoning: `This looks closest, but I am not certain.`,
        sensitive: Boolean(best.sensitive),
        instruction: best.sensitive ? best.instruction : null,
      });
    }

    // Low confidence does not highlight (spec section 52). Saying "I cannot find it" is a
    // better answer than ringing the wrong control.
    return record({ index: null, confidence: "low", tier: "none", element: null, reasoning: "I could not find that on this screen." });
  }

  async #askModel(goal, elements) {
    if (!this.ai?.chat) return null;
    try {
      const status = await this.ai.status?.();
      if (status?.ollama && status.ollama.available === false) return null;

      // Only labels are sent. Values were removed before this point.
      const list = elements
        .slice(0, 120)
        .map((element) => `${element.i}: <${element.tag}> ${element.text || element.aria || element.placeholder || element.href || ""}`)
        .join("\n");

      const answer = await this.ai.chat({
        prompt: `A user wants to: "${goal}".\n\nThese are the clickable things on the screen:\n${list}\n\nReply with only the number of the one they should click, or the word NONE. No explanation.`,
      });

      const raw = String(answer?.text ?? "").trim();
      const parsed = raw.match(/\d+/);
      if (!parsed) return null;
      const index = Number(parsed[0]);

      // The model's answer is checked against the real list; an out-of-range index is
      // treated as no answer rather than followed.
      const element = elements.find((item) => item.i === index);
      if (!element) return null;

      return {
        index, confidence: "medium", tier: "model",
        element, reasoning: "Best guess based on what the screen offers.",
        sensitive: Boolean(element.sensitive),
        instruction: element.sensitive ? element.instruction : null,
      };
    } catch {
      return null;
    }
  }
}
