import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Playbook cache (adopted guide spec section 28, acceptance criterion 16).
//
// What is cached is an element *signature* — what the thing looked like — never its
// position. Coordinates go stale the moment a page reflows, and a ring drawn from a stale
// coordinate points confidently at the wrong control, which is worse than no ring.
//
// So on reuse the signature is re-resolved against the DOM as it is now. If it no longer
// resolves, the entry is deleted and matching runs again. That is the "self-healing" the
// criterion asks for.

const normalizeGoal = (goal) =>
  String(goal ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Only stable, describable attributes. No rects, no indexes into a previous DOM.
const signatureOf = (element = {}) => ({
  tag: element.tag ?? null,
  text: (element.text ?? "").slice(0, 120),
  aria: (element.aria ?? "").slice(0, 120),
  role: element.role ?? null,
  // Query strings change per session; the path is what identifies a destination.
  hrefPattern: element.href ? String(element.href).split("?")[0].slice(0, 160) : null,
  nearby: (element.nearby ?? "").slice(0, 120),
});

const key = (tenantId, host, goal, stepContext = "") =>
  [tenantId, host, normalizeGoal(goal), stepContext].join("|");

export class PlaybookCache {
  constructor({ stateFile } = {}) {
    this.stateFile = stateFile;
    this.entries = new Map();
  }

  async load() {
    if (!this.stateFile) return this;
    await mkdir(dirname(this.stateFile), { recursive: true });
    try {
      for (const entry of JSON.parse(await readFile(this.stateFile, "utf8"))) this.entries.set(entry.key, entry);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    return this;
  }

  async save() {
    if (this.stateFile) await writeFile(this.stateFile, JSON.stringify([...this.entries.values()], null, 2));
  }

  async remember(tenantId, { host, goal, stepContext, element }) {
    if (!element) return null;
    const entry = {
      key: key(tenantId, host, goal, stepContext),
      tenantId, host, goal: normalizeGoal(goal), stepContext: stepContext ?? "",
      signature: signatureOf(element),
      rememberedAt: new Date().toISOString(),
    };
    this.entries.set(entry.key, entry);
    await this.save();
    return entry;
  }

  // Re-resolve against the DOM as it is right now. A signature that matches nothing is
  // dropped, so a stale playbook cannot survive a redesign of the provider's page.
  async resolve(tenantId, { host, goal, stepContext, elements = [] }) {
    const entryKey = key(tenantId, host, goal, stepContext);
    const entry = this.entries.get(entryKey);
    if (!entry) return null;

    const match = elements.find((element) => {
      const candidate = signatureOf(element);
      if (entry.signature.tag && candidate.tag !== entry.signature.tag) return false;
      // Any one strong identifier is enough, because pages rewrite the others.
      if (entry.signature.text && candidate.text === entry.signature.text) return true;
      if (entry.signature.aria && candidate.aria === entry.signature.aria) return true;
      if (entry.signature.hrefPattern && candidate.hrefPattern === entry.signature.hrefPattern) return true;
      return false;
    });

    if (!match) {
      this.entries.delete(entryKey);
      await this.save();
      return null;
    }

    return { index: match.i, element: match, fromCache: true };
  }

  // Tenant-scoped: one company's playbooks are never served to another.
  list(tenantId) {
    return [...this.entries.values()].filter((entry) => !tenantId || entry.tenantId === tenantId);
  }

  async forget(tenantId) {
    for (const [entryKey, entry] of this.entries) if (entry.tenantId === tenantId) this.entries.delete(entryKey);
    await this.save();
  }
}

export { signatureOf, normalizeGoal };
