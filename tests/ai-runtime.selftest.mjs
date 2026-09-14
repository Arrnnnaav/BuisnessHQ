import assert from "node:assert/strict";
import { AiRuntime, ModelRouter } from "../core/runtime/index.mjs";

const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({ url, options });
  if (url.endsWith("/api/tags")) return new Response(JSON.stringify({ models: [{ name: "qwen3:8b", size: 1 }] }), { status: 200 });
  if (url.endsWith("/api/chat")) return new Response(JSON.stringify({ message: { content: "Local answer" }, prompt_eval_count: 12, eval_count: 4 }), { status: 200 });
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Cloud answer" }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3 } }), { status: 200 });
};
const runtime = new AiRuntime({ fetchImpl });
assert.equal((await runtime.status()).ollama.models[0].name, "qwen3:8b");
const local = await runtime.generate({ route: { provider: "ollama", model: "qwen3:8b" }, messages: [{ role: "user", content: "Hello" }] });
assert.equal(local.text, "Local answer");
assert.equal(local.fallback, false);
const cloud = await runtime.generate({ route: { provider: "gemini", model: "gemini-3.8-flash" }, apiKey: "test-key", messages: [{ role: "user", content: "Hello" }] });
assert.equal(cloud.text, "Cloud answer");
assert.equal(new ModelRouter({ configured: (provider) => provider === "ollama" }).select({ mode: "balanced" }).model, "qwen3:4b-instruct");
assert.equal(calls.length, 3);

let attempts = 0;
const constrainedRuntime = new AiRuntime({ fetchImpl: async (url, options) => {
  attempts += 1;
  if (url.endsWith("/api/chat")) return new Response('{"error":"local runtime unavailable"}', { status: 500 });
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Cloud fallback answer" }] } }], usageMetadata: {} }), { status: 200 });
} });
const fallback = await constrainedRuntime.generate({ route: { provider: "ollama", model: "qwen3:4b-instruct", cloudModel: "gemini-3.8-flash", allowCloudFallback: true }, apiKey: "test-key", messages: [{ role: "user", content: "Hello" }] });
assert.equal(fallback.provider, "gemini");
assert.equal(fallback.model, "gemini-3.8-flash");
assert.equal(fallback.fallback, true);
assert.equal(fallback.fallbackFrom, "ollama:qwen3:4b-instruct");
assert.equal(attempts, 2);
console.log("AI runtime self-test passed");
