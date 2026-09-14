/** Small in-process event bus used by the local-first runtime. */
export class EventBus {
  #handlers = new Map();

  on(type, handler) {
    const handlers = this.#handlers.get(type) ?? new Set();
    handlers.add(handler);
    this.#handlers.set(type, handlers);
    return () => handlers.delete(handler);
  }

  async emit(event) {
    if (!event?.type) throw new Error("Event type is required");
    const handlers = [...(this.#handlers.get(event.type) ?? [])];
    await Promise.all(handlers.map((handler) => handler(event)));
    return handlers.length;
  }
}
