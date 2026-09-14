import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { validatePluginContract } from "./universal-plugin-contract.mjs";

const exists = async (path) => { try { await access(path); return true; } catch { return false; } };

export async function analyzeRepository(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".venv") continue;
    files.push(entry.name);
  }
  const has = async (file) => exists(join(root, file));
  const pluginManifest = await has("plugin.json") ? JSON.parse(await readFile(join(root, "plugin.json"), "utf8")) : null;
  const signals = {
    native: Boolean(pluginManifest),
    mcp: files.some((file) => /mcp/i.test(file)) || await has("mcp.json"),
    api: await has("openapi.json") || await has("openapi.yaml"),
    python: await has("pyproject.toml") || await has("requirements.txt") || await has("main.py"),
    node: await has("package.json"),
    container: await has("Dockerfile") || await has("docker-compose.yml"),
    cli: await has("README.md") && (await readFile(join(root, "README.md"), "utf8")).includes("--help"),
  };
  let compatibility = { level: 0, label: "Unsupported", reason: "No supported plugin interface detected" };
  if (signals.native) compatibility = { level: 5, label: "Native Plugin", reason: "Repository declares businessos-plugin/v1" };
  else if (signals.mcp) compatibility = { level: 4, label: "MCP Compatible", reason: "MCP interface detected" };
  else if (signals.api) compatibility = { level: 3, label: "API Compatible", reason: "OpenAPI interface detected" };
  else if (signals.cli) compatibility = { level: 2, label: "CLI Compatible", reason: "CLI usage detected in README" };
  else if (signals.python || signals.node || signals.container) compatibility = { level: 1, label: "Adapter Required", reason: "Runtime detected but no stable plugin interface" };
  return {
    sourceType: "local-or-cloned-repository",
    root,
    files,
    signals,
    compatibility,
    declaredPlugin: pluginManifest,
    contract: pluginManifest ? validatePluginContract(pluginManifest) : null,
    safeNextStep: pluginManifest ? "review-manifest" : "generate-adapter-draft",
  };
}
