const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export class AiRuntime {
  constructor({ ollamaUrl = DEFAULT_OLLAMA_URL, fetchImpl = fetch } = {}) { this.ollamaUrl = ollamaUrl.replace(/\/$/, ""); this.fetch = fetchImpl; }

  async status() {
    try {
      const response = await this.fetch(`${this.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
      const data = await response.json();
      return { ollama: { available: true, models: (data.models ?? []).map((model) => ({ name: model.name, size: model.size, modifiedAt: model.modified_at })) } };
    } catch (error) { return { ollama: { available: false, models: [], error: error.message } }; }
  }

  async pullModel(model) {
    if (!/^[a-zA-Z0-9._:-]+$/.test(model)) throw new Error("Invalid Ollama model name");
    const response = await this.fetch(`${this.ollamaUrl}/api/pull`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, stream: false }), signal: AbortSignal.timeout(30 * 60 * 1000) });
    if (!response.ok) throw new Error(`Ollama pull failed: ${response.status} ${await response.text()}`);
    return response.json();
  }

  async embed(input, model = "embeddinggemma") {
    const response = await this.fetch(`${this.ollamaUrl}/api/embed`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, input: Array.isArray(input) ? input : [input] }), signal: AbortSignal.timeout(5 * 60 * 1000) });
    if (!response.ok) throw new Error(`Ollama embedding failed: ${response.status} ${await response.text()}`);
    const data = await response.json(); return data.embeddings ?? [];
  }

  #unreachable(error) {
    const network = /fetch failed|ECONNREFUSED|ENOTFOUND|timeout|aborted/i.test(error?.message ?? "")
      || /ECONNREFUSED|ENOTFOUND/.test(error?.cause?.code ?? "");
    if (!network) return error;
    return new Error("No AI is available yet. Set one up under AI & Connections — either install the local model or add a provider key.");
  }

  async generate({ route, apiKey, messages, structured = false, temperature = 0.2 }) {
    const started = Date.now();
    if (route.provider === "ollama") {
      try {
        const response = await this.fetch(`${this.ollamaUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "qwen3:4b-instruct", messages, stream: false, format: structured ? "json" : undefined, options: { temperature, num_ctx: 4096 } }), signal: AbortSignal.timeout(5 * 60 * 1000) });
        if (!response.ok) throw new Error(`Ollama generation failed: ${response.status} ${await response.text()}`);
        const data = await response.json();
        return { provider: "ollama", model: "qwen3:4b-instruct", fallback: false, text: data.message?.content ?? "", usage: { inputTokens: data.prompt_eval_count ?? 0, outputTokens: data.eval_count ?? 0 }, durationMs: Date.now() - started };
      } catch (error) {
        // With no local model reachable and no cloud key, the owner needs to be told what
        // to do, not shown "fetch failed" from a socket they never knew existed.
        if (!route.allowCloudFallback || !apiKey) throw this.#unreachable(error);
        const result = await this.generate({ route: { provider: "gemini", model: route.cloudModel ?? "gemini-3.8-flash" }, apiKey, messages, structured, temperature });
        return { ...result, fallback: true, fallbackFrom: "ollama:qwen3:4b-instruct" };
      }
    }
    if (route.provider === "gemini") {
      if (!apiKey) throw new Error("Add the AI API key in AI & Connections or use local Ollama mode");
      const system = messages.find((message) => message.role === "system")?.content;
      const contents = messages.filter((message) => message.role !== "system").map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] }));
      const response = await this.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(route.model)}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ system_instruction: system ? { parts: [{ text: system }] } : undefined, contents, generationConfig: { responseMimeType: structured ? "application/json" : "text/plain" } }), signal: AbortSignal.timeout(5 * 60 * 1000) });
      if (!response.ok) throw new Error(`Gemini generation failed: ${response.status} ${await response.text()}`);
      const data = await response.json(); const usage = data.usageMetadata ?? {};
      return { provider: "gemini", model: route.model, text: data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "", usage: { inputTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0 }, durationMs: Date.now() - started };
    }
    throw new Error(`Unsupported AI provider: ${route.provider}`);
  }
}
