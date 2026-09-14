const PROFILES = {
  private: { preferred: ["ollama"], fallback: [] },
  balanced: { preferred: ["ollama", "gemini"], fallback: [] },
  quality: { preferred: ["gemini", "ollama"], fallback: [] },
  economical: { preferred: ["ollama", "gemini"], fallback: [] },
};
const LOCAL_MODEL = "qwen3:4b-instruct";

export class ModelRouter {
  constructor({ configured = () => false, cloudModel = "gemini-3.8-flash" } = {}) { this.configured = configured; this.cloudModel = cloudModel; }
  select({ mode = "balanced", task = "reasoning", requiresPrivate = false } = {}) {
    const profile = PROFILES[requiresPrivate ? "private" : mode] ?? PROFILES.balanced;
    const candidates = [...profile.preferred, ...profile.fallback];
    const provider = candidates.find((candidate) => this.configured(candidate)) ?? (requiresPrivate ? "ollama" : candidates[0]);
    const model = provider === "ollama" ? LOCAL_MODEL : this.cloudModel;
    return { provider, model, cloudModel: this.cloudModel, allowCloudFallback: provider === "ollama" && !requiresPrivate && mode !== "private", mode: requiresPrivate ? "private" : mode, task, ready: this.configured(provider), reason: this.configured(provider) ? "Configured provider selected by policy" : "Provider is selected but needs credentials or a local Ollama service" };
  }
}
