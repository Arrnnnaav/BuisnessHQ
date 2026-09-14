import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "agents/team.json",
  "agents/contracts.json",
  "skills/strategy.json",
  "skills/safety.json",
  "workflows/closed-loop.json",
  "settings/defaults.json",
  "services/safety.mjs",
  "services/metrics.mjs"
];

const missing = [];
for (const path of required) {
  try { await access(resolve(root, path)); }
  catch { missing.push(path); }
}
const team = JSON.parse(await readFile(resolve(root, "agents/team.json"), "utf8"));
const employees = team.employees ?? team.agents ?? [];
const result = { healthy: missing.length === 0 && employees.length === 7, missing, employees: employees.length, externalWrites: false };
console.log(JSON.stringify(result));
if (!result.healthy) process.exitCode = 1;
