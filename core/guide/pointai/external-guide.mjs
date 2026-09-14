import { randomUUID } from "node:crypto";
import { sanitizeElements } from "./sensitive-fields.mjs";
import { setupPlaybook } from "./setup-playbooks.mjs";

const ALLOWED_HOSTS = new Set(["search.google.com", "wordpress.com", "www.wordpress.com"]);

export function validateExternalGuideUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("External guide URL must be valid HTTPS"); }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new Error("External guide can open only an allowlisted HTTPS provider page");
  return url.href;
}

export class ExternalGuideSession {
  constructor({ matcher, audit } = {}) { this.matcher = matcher; this.audit = audit; this.sessions = new Map(); }
  start({ playbookId, url }) {
    const playbook = setupPlaybook(playbookId);
    const safeUrl = validateExternalGuideUrl(url ?? playbook.url);
    const session = { id: randomUUID(), playbookId, url: safeUrl, step: 0, status: "active", createdAt: new Date().toISOString() };
    this.sessions.set(session.id, session); this.audit?.record({ action: "pointai.external-session-started", sessionId: session.id, playbookId });
    return { ...session, playbook: { title: playbook.title, steps: playbook.steps } };
  }
  observe(id, { elements = [], goal = "", host } = {}) {
    const session = this.sessions.get(id); if (!session) throw new Error("External guide session not found");
    const safeElements = sanitizeElements(elements).map(({ value, ...element }) => element);
    const result = this.matcher ? this.matcher.match({ goal, elements: safeElements, host: host ?? new URL(session.url).hostname, stepContext: session.playbookId }) : { index: null, confidence: "low", reasoning: "A browser guide adapter is not connected." };
    return { sessionId: id, step: session.step, elements: safeElements, match: result };
  }
  advance(id) { const session = this.sessions.get(id); if (!session) throw new Error("External guide session not found"); session.step += 1; return session; }
  complete(id) { const session = this.sessions.get(id); if (!session) throw new Error("External guide session not found"); session.status = "completed"; session.completedAt = new Date().toISOString(); return session; }
}
