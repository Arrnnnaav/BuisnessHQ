export class CapabilityRegistry {
  #providers = new Map();

  register(pluginId, capabilities, { priority = 0, privacy = "unknown", cost = "unknown" } = {}) {
    for (const capability of capabilities) {
      const id = typeof capability === "string" ? capability : capability.id;
      const providers = this.#providers.get(id) ?? [];
      providers.push({ pluginId, priority, privacy, cost });
      providers.sort((a, b) => b.priority - a.priority);
      this.#providers.set(id, providers);
    }
  }

  find(capability) { return [...(this.#providers.get(capability) ?? [])]; }

  list() { return [...this.#providers.entries()].map(([id, providers]) => ({ id, providers })); }
}
