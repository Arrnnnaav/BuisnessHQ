import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const seed = {
  business: { name: "ABizCreator", subtitle: "Printing & Creative Business", location: "Jaipur, Rajasthan", mode: "Copilot" },
  metrics: { leads: 7, quotes: 4, visibility: 8, reviews: 5, organicLeads: 14 },
  approvals: [
    { id: "approval-review-1", title: "Reply to 1-star review", detail: "A draft response is ready for owner approval.", risk: "high", status: "pending" },
    { id: "approval-price-1", title: "Review brochure pricing recommendation", detail: "Suggested margin adjustment for 2,000 brochures.", risk: "high", status: "pending" }
  ],
  brain: [
    { id: "fact-1", type: "fact", key: "primary_location", value: "Jaipur, Rajasthan", source: "owner onboarding", confidence: 1, status: "verified" },
    { id: "fact-2", type: "policy", key: "urgent_delivery", value: "Requires owner confirmation before promising", source: "owner rule", confidence: 1, status: "verified" },
    { id: "fact-3", type: "learning", key: "project_content", value: "Real project posts outperform generic promotional graphics", source: "growth memory", confidence: 0.82, status: "suggested" }
  ],
  activity: [
    { id: "activity-1", text: "SEO audit completed", time: "Today, 09:40", tone: "success" },
    { id: "activity-2", text: "3 stale quotes flagged", time: "Today, 09:15", tone: "warning" },
    { id: "activity-3", text: "Company Brain updated with owner rule", time: "Yesterday", tone: "info" }
  ], plugins: [], marketplace: []
};

export class AppStore {
  constructor(file) { this.file = file; this.state = structuredClone(seed); }
  async load() { await mkdir(dirname(this.file), { recursive: true }); try { this.state = JSON.parse(await readFile(this.file, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; await this.save(); } return this.state; }
  async save() { await writeFile(this.file, JSON.stringify(this.state, null, 2)); }
  async addBrainFact(input) { const fact = { id: randomUUID(), type: input.type ?? "fact", key: input.key, value: input.value, source: input.source ?? "owner input", confidence: 1, status: "verified" }; this.state.brain.unshift(fact); this.state.activity.unshift({ id: randomUUID(), text: `Company Brain updated: ${fact.key}`, time: "Just now", tone: "info" }); await this.save(); return fact; }
  async decideApproval(id, decision) { const item = this.state.approvals.find((approval) => approval.id === id); if (!item) return null; item.status = decision; item.decidedAt = new Date().toISOString(); this.state.activity.unshift({ id: randomUUID(), text: `${item.title}: ${decision}`, time: "Just now", tone: decision === "approved" ? "success" : "warning" }); await this.save(); return item; }
}
