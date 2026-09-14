import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Core tasks and reminders (GrowthOS plan section 101, guide spec section 38).
//
// Tasks are core rather than a plugin: the Guide, Needs You and any installed app all
// create them, and they must outlive the uninstall of whatever suggested them.

const STATUSES = new Set(["open", "done", "dismissed"]);

export class TaskStore {
  constructor({ stateFile } = {}) {
    this.stateFile = stateFile;
    this.tasks = new Map();
  }

  async load() {
    if (!this.stateFile) return this.list();
    await mkdir(dirname(this.stateFile), { recursive: true });
    try {
      for (const task of JSON.parse(await readFile(this.stateFile, "utf8"))) this.tasks.set(task.id, task);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    return this.list();
  }

  async save() {
    if (this.stateFile) await writeFile(this.stateFile, JSON.stringify([...this.tasks.values()], null, 2));
  }

  async create(tenantId, { title, detail = "", dueAt = null, source = "owner", pluginId = null } = {}) {
    const trimmed = String(title ?? "").trim();
    if (!trimmed) throw new Error("A task needs a title");
    const task = {
      id: randomUUID(), tenantId, title: trimmed, detail,
      dueAt: dueAt ?? null, status: "open",
      // Recorded so the owner can always see what put a task on their list — a task that
      // appears with no explanation is indistinguishable from noise.
      source, pluginId,
      createdAt: new Date().toISOString(), completedAt: null,
    };
    this.tasks.set(task.id, task);
    await this.save();
    return task;
  }

  async setStatus(tenantId, id, status) {
    if (!STATUSES.has(status)) throw new Error(`Unknown task status: ${status}`);
    const task = this.tasks.get(id);
    if (!task || task.tenantId !== tenantId) throw new Error("Task not found");
    task.status = status;
    task.completedAt = status === "done" ? new Date().toISOString() : null;
    await this.save();
    return task;
  }

  async remove(tenantId, id) {
    const task = this.tasks.get(id);
    if (!task || task.tenantId !== tenantId) throw new Error("Task not found");
    this.tasks.delete(id);
    await this.save();
    return { id };
  }

  list(tenantId, { status } = {}) {
    return [...this.tasks.values()]
      .filter((task) => !tenantId || task.tenantId === tenantId)
      .filter((task) => !status || task.status === status)
      .sort((left, right) => {
        // Anything with a due date comes first, earliest first; undated work follows in
        // creation order.
        if (left.dueAt && right.dueAt) return left.dueAt.localeCompare(right.dueAt);
        if (left.dueAt) return -1;
        if (right.dueAt) return 1;
        return left.createdAt.localeCompare(right.createdAt);
      });
  }

  dueCount(tenantId) {
    const now = new Date().toISOString();
    return this.list(tenantId, { status: "open" }).filter((task) => task.dueAt && task.dueAt <= now).length;
  }
}
