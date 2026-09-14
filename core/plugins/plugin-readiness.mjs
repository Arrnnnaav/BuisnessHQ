import { existsSync } from "node:fs";
import { resolve } from "node:path";

const RELEASE_STAGES = new Set(["scaffold", "preview", "pilot", "production", "internal"]);
const CUSTOMER_STAGES = new Set(["preview", "pilot", "production"]);

function scriptPath(command) {
  const match = String(command ?? "").match(/^(?:node|npm|pnpm|py(?:thon)?(?:\s+-\d+(?:\.\d+)?)?)\s+([^\s]+)/i);
  return match?.[1] ?? null;
}

export function assessPluginReadiness(manifest, pluginPath) {
  const release = manifest.businessos?.release ?? {};
  const declaredStage = release.stage ?? "scaffold";
  const errors = [];
  const warnings = [];
  const implementationIssue = (message) => (declaredStage === "scaffold" ? warnings : errors).push(message);

  if (!RELEASE_STAGES.has(declaredStage)) errors.push(`unknown release stage: ${declaredStage}`);
  if (!Array.isArray(manifest.permissions?.required)) errors.push("permissions.required must be an array");
  if (manifest.permissions?.optional != null && !Array.isArray(manifest.permissions.optional)) errors.push("permissions.optional must be an array");

  for (const [label, relativePath] of Object.entries(manifest.fileStructure ?? {})) {
    if (typeof relativePath !== "string" || !relativePath.trim()) implementationIssue(`fileStructure.${label} must be a path`);
    else if (!existsSync(resolve(pluginPath, relativePath))) implementationIssue(`declared path is missing: ${relativePath}`);
  }
  for (const [label, command] of Object.entries(manifest.scripts ?? {})) {
    const relativePath = scriptPath(command);
    if (!relativePath) warnings.push(`cannot verify script.${label}: ${command}`);
    else if (!existsSync(resolve(pluginPath, relativePath))) implementationIssue(`declared script is missing: ${relativePath}`);
  }

  const customerAvailable = release.customerAvailable === true;
  if (customerAvailable && !CUSTOMER_STAGES.has(declaredStage)) errors.push("customerAvailable requires preview, pilot, or production stage");
  if (declaredStage === "scaffold") warnings.push("manifest-only concept; implementation is not complete");
  if (declaredStage === "preview") warnings.push(release.limitation ?? "preview capability; review limitations before use");
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) warnings.push("no agent capabilities declared");

  return {
    stage: declaredStage,
    label: declaredStage === "scaffold" ? "Planned" : declaredStage === "internal" ? "Internal" : declaredStage[0].toUpperCase() + declaredStage.slice(1),
    customerAvailable,
    installable: customerAvailable && CUSTOMER_STAGES.has(declaredStage) && errors.length === 0,
    customerProductionReady: customerAvailable && declaredStage === "production" && errors.length === 0,
    limitation: release.limitation ?? null,
    requiredIntegrations: release.requiredIntegrations ?? [],
    errors,
    warnings,
  };
}

export function validatePluginDependencies(entries) {
  const byId = new Map(entries.map((entry) => [entry.manifest.id, entry]));
  const errors = [];
  for (const entry of entries) {
    for (const dependency of entry.manifest.dependencies ?? []) {
      if (!byId.has(dependency)) errors.push(`${entry.manifest.id} requires missing plugin ${dependency}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id, trail = []) => {
    if (visiting.has(id)) { errors.push(`dependency cycle: ${[...trail, id].join(" -> ")}`); return; }
    if (visited.has(id) || !byId.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).manifest.dependencies ?? []) visit(dependency, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
  return [...new Set(errors)];
}
