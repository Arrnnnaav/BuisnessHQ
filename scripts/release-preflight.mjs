import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PluginManager } from "../core/runtime/plugin-manager.mjs";
import { validatePluginDependencies } from "../core/plugins/plugin-readiness.mjs";
import { validatePackageManifest } from "../core/packages/package-registry.mjs";
import { FIRST_PARTY_PACKAGES } from "../control-plane/first-party-packages.mjs";

const TARGETS = new Set(["staging", "pilot", "production"]);
const requiredFiles = [
  "apps/server.mjs",
  "operator/server.mjs",
  "control-plane/telemetry-contract.mjs",
  "control-plane/plugin-registry.mjs",
  "core/guide/pointai/external-guide.mjs",
  "core/guide/pointai/sensitive-fields.mjs",
  "core/agents/agent-planner.mjs",
  "core/packages/package-registry.mjs",
  "apps/dashboard/src/core/guide/GuidePanel.jsx",
];

function operationalChecks(target, env) {
  const checks = [];
  const add = (id, passed, detail) => checks.push({ id, passed, detail });
  add("external-writes-default-off", env.BUSINESSOS_EXTERNAL_WRITES !== "1", "Customer preflight must not silently enable external writes.");
  if (target !== "staging") {
    add("customer-consent", env.CUSTOMER_PILOT_APPROVED === "1", "Set only after the named pilot customer has consented to the agreed scope.");
    add("operator-token", String(env.OPERATOR_TOKEN ?? "").length >= 32, "Use a unique operator token of at least 32 characters.");
    add("ai-provider", env.BUSINESSOS_AI_CONFIGURED === "1", "Confirm Ollama or an encrypted tenant AI credential has been tested.");
    add("tls", env.BUSINESSOS_TLS_TERMINATED === "1", "Confirm HTTPS terminates at the deployment proxy/load balancer.");
    add("backup-restore", env.BUSINESSOS_BACKUP_CONFIGURED === "1", "Confirm backup and restore have been exercised for the customer data root.");
  }
  return checks;
}

export async function runPreflight({ root = resolve("."), target = "staging", env = process.env } = {}) {
  if (!TARGETS.has(target)) throw new Error(`Unknown target ${target}; choose staging, pilot, or production`);
  const manager = new PluginManager({ root: resolve(root, "plugins") });
  await manager.discover();
  const plugins = manager.list().map((entry) => ({ ...entry, manifest: manager.manifestFor(entry.id) }));
  const dependencyErrors = validatePluginDependencies(plugins);
  const packageErrors = [];
  const packageKeys = new Set(FIRST_PARTY_PACKAGES.map((item) => `${item.type}:${item.id}`));
  const pluginIds = new Set(plugins.map((item) => item.id));
  for (const item of FIRST_PARTY_PACKAGES) {
    const validation = validatePackageManifest(item);
    for (const error of validation.errors) packageErrors.push(`${item.type}:${item.id}: ${error}`);
    for (const skill of item.skills ?? []) if (!packageKeys.has(`skill:${skill}`)) packageErrors.push(`agent:${item.id} requires missing skill ${skill}`);
    for (const plugin of item.requiredPlugins ?? []) if (!pluginIds.has(plugin)) packageErrors.push(`${item.type}:${item.id} requires missing plugin ${plugin}`);
  }

  const fileErrors = requiredFiles.filter((path) => !existsSync(resolve(root, path))).map((path) => `required release file is missing: ${path}`);
  const readinessErrors = plugins.flatMap((item) => item.readiness.errors.map((error) => `${item.id}: ${error}`));
  const operational = operationalChecks(target, env);
  const targetErrors = operational.filter((item) => !item.passed).map((item) => `${item.id}: ${item.detail}`);
  if (target === "production" && !plugins.some((item) => item.readiness.customerProductionReady)) targetErrors.push("no plugin has passed the production release stage; use a controlled pilot, not a general launch");

  const agents = FIRST_PARTY_PACKAGES.filter((item) => item.type === "agent").map((item) => ({ id: item.id, capabilities: item.capabilities, skills: item.skills, requiredPlugins: item.requiredPlugins }));
  const report = {
    generatedAt: new Date().toISOString(),
    target,
    verdict: [...dependencyErrors, ...packageErrors, ...fileErrors, ...readinessErrors, ...targetErrors].length === 0 ? "PASS" : "BLOCKED",
    summary: {
      plugins: plugins.length,
      installable: plugins.filter((item) => item.readiness.installable).length,
      planned: plugins.filter((item) => item.readiness.stage === "scaffold").length,
      packages: FIRST_PARTY_PACKAGES.length,
      agents: agents.length,
    },
    plugins: plugins.map(({ manifest, ...item }) => ({ ...item, dependencies: manifest.dependencies ?? [], capabilities: manifest.capabilities ?? [], permissions: manifest.permissions ?? { required: [], optional: [] } })),
    packages: FIRST_PARTY_PACKAGES.map(({ content, ...item }) => item),
    agents,
    operational,
    errors: [...dependencyErrors, ...packageErrors, ...fileErrors, ...readinessErrors, ...targetErrors],
  };
  return report;
}

function printReport(report) {
  console.log(`BusinessOS ${report.target} release preflight: ${report.verdict}`);
  console.log(`${report.summary.plugins} plugins (${report.summary.installable} installable, ${report.summary.planned} planned) · ${report.summary.packages} packages · ${report.summary.agents} orchestrated agents`);
  for (const plugin of report.plugins) console.log(`- ${plugin.id.padEnd(18)} ${plugin.readiness.label.padEnd(10)} ${plugin.readiness.installable ? "installable" : "visible only"}${plugin.readiness.limitation ? ` — ${plugin.readiness.limitation}` : ""}`);
  if (report.errors.length) {
    console.log("Blocking conditions:");
    for (const error of report.errors) console.log(`- ${error}`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const targetArg = process.argv.find((value) => value.startsWith("--target="))?.split("=")[1] ?? "staging";
  const report = await runPreflight({ target: targetArg });
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  if (report.verdict !== "PASS") process.exitCode = 1;
}
