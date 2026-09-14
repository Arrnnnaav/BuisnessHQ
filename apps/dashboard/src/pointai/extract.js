// Element extraction for internal PointAI guidance.
//
// Ported from the standalone PointAI project (`frontend/src/lib/matcher.js`).
// Changes made during the port:
//  - The original read from a same-origin iframe holding a sanitized copy of a third-party
//    page. Here it reads the real dashboard document directly, so there is no copy, no
//    sanitizer, and nothing to go stale between extraction and highlighting.
//  - Field values are never collected. The original never sent them either, but here the
//    omission is explicit because the server refuses to accept them.

const INTERACTIVE = [
  "a[href]", "button", "input:not([type=hidden])", "textarea", "select",
  "[role='button']", "[role='link']", "[role='menuitem']", "[role='tab']",
  "[role='checkbox']", "[role='switch']", "[tabindex]:not([tabindex='-1'])",
].join(",");

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (parseFloat(style.opacity || "1") < 0.05) return false;
  return true;
}

const clean = (text) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 140);

// The label of whatever a field sits inside, which is often the only thing that names it.
function nearbyText(element) {
  const label = element.labels?.[0]?.innerText
    ?? element.closest("label")?.innerText
    ?? element.closest("[role='group'], fieldset, .card, .danger-row")?.querySelector("b, h2, h3, label")?.innerText;
  return clean(label);
}

export function extractElements(root = document) {
  const refs = [];
  const compact = [];
  let index = 0;

  for (const element of root.querySelectorAll(INTERACTIVE)) {
    // The Guide's own panel is not part of the screen being explained.
    if (element.closest(".guide-panel, .guide-launcher")) continue;
    if (!isVisible(element)) continue;

    const tag = element.tagName.toLowerCase();
    const text = clean(element.innerText || element.textContent);
    const aria = clean(element.getAttribute("aria-label"));
    const placeholder = clean(element.getAttribute("placeholder"));
    const href = clean(element.getAttribute("href")).slice(0, 160);
    if (!text && !aria && !placeholder && !href && tag !== "input" && tag !== "select") continue;

    refs.push(element);
    compact.push({
      i: index, tag, text, aria, placeholder, href,
      role: clean(element.getAttribute("role")),
      type: clean(element.getAttribute("type")),
      name: clean(element.getAttribute("name")),
      id: clean(element.getAttribute("id")),
      autocomplete: clean(element.getAttribute("autocomplete")),
      label: nearbyText(element),
      nearby: nearbyText(element),
      // No `value`. Deliberate: see the module comment.
    });

    index += 1;
    if (index >= 250) break;
  }

  return { refs, compact };
}
