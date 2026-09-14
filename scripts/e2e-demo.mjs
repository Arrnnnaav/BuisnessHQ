import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

let baseUrl = process.env.BUSINESSOS_URL ?? "http://127.0.0.1:4173";
const requireAi = process.env.BUSINESSOS_E2E_REQUIRE_AI !== "0";
// By default the smoke test owns a temporary server and data directory. Supplying a
// BUSINESSOS_URL targets an already-running deployment instead.
const isolated = process.env.BUSINESSOS_E2E_ISOLATED !== "0" && !process.env.BUSINESSOS_URL;
const credentials = { name: "Demo Owner", email: "demo.owner@businessos.local", password: "DemoBusinessOS!2026" };
let child = null;
let isolatedRoot = null;
let serverOutput = "";

const request = async (path, { token, method = "GET", body } = {}) => {
  let response;
  try { response = await fetch(`${baseUrl}${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch (error) { throw new Error(`${path}: network request failed${serverOutput ? `\nServer output:\n${serverOutput}` : ""}`, { cause: error }); }
  const result = await response.json();
  if (!response.ok) throw new Error(`${path}: ${result.error ?? response.status}`);
  return result;
};

const expectRejected = async (path, { token, method = "POST", body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (response.ok) throw new Error(`${path}: expected the release gate to reject this request`);
  return result;
};

const freePort = () => new Promise((accept, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => { const { port } = probe.address(); probe.close(() => accept(port)); });
});

async function startIsolatedServer() {
  isolatedRoot = await mkdtemp(join(tmpdir(), "businessos-e2e-"));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [resolve("apps/server.mjs")], {
    cwd: resolve("."),
    windowsHide: true,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", BUSINESSOS_DATA_ROOT: isolatedRoot },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { serverOutput += chunk; });
  child.stderr.on("data", (chunk) => { serverOutput += chunk; });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode != null) throw new Error(`Isolated server exited with ${child.exitCode}\n${serverOutput}`);
    try { await request("/api/health"); return; }
    catch { await new Promise((accept) => setTimeout(accept, 100)); }
  }
  throw new Error(`Isolated server did not become ready\n${serverOutput}`);
}

async function run() {
  if (isolated) await startIsolatedServer();
  const status = await request("/api/auth/status");
  const account = status.initialized ? await request("/api/auth/login", { method: "POST", body: credentials }) : await request("/api/auth/register", { method: "POST", body: credentials });
  const token = account.session.token;
  let state = await request("/api/state", { token });
  const apps = await request("/api/apps", { token });
  const catalogApp = apps.find((item) => item.id === "catalog");
  const plannedCrm = apps.find((item) => item.id === "crm");
  if (!catalogApp?.installable || plannedCrm?.installable !== false) throw new Error("Marketplace readiness labels are incorrect");
  const rejectedInstall = await expectRejected("/api/apps/crm/install", { token });
  if (!/cannot be installed/i.test(rejectedInstall.error ?? "")) throw new Error("Planned app installation was not rejected by the server release gate");
  if (state.profile.businessName !== "ABizCreator Demo") await request("/api/demo/seed", { token, method: "POST", body: {} });
  await request("/api/profile", { token, method: "PUT", body: { localModel: "qwen3:4b-instruct", aiMode: "private" } });
  state = await request("/api/state", { token });
  const approval = state.approvals[0];
  if (approval) await request(`/api/approvals/${approval.id}`, { token, method: "POST", body: { decision: "approved", comment: "Approved during isolated local demo validation" } });
  const semantic = await request("/api/semantic/reindex", { token, method: "POST", body: {} });
  const ai = requireAi
    ? await request("/api/ai/chat", { token, method: "POST", body: { prompt: "Using only the company context, name two verified services and one safe local SEO priority. Keep it concise.", requiresPrivate: true } })
    : { provider: "skipped", model: "not-required", usage: { outputTokens: 0 }, text: "AI generation skipped by BUSINESSOS_E2E_REQUIRE_AI=0" };
  state = await request("/api/state", { token });
  if (state.profile.externalWritesEnabled !== false) throw new Error("Demo safety invariant failed: external writes must remain disabled");
  if (state.catalog.length < 1 || state.brain.length < 1) throw new Error("Demo seed invariant failed: catalog and Company Brain must contain data");
  console.log(JSON.stringify({ owner: account.user.email, business: state.profile.businessName, environment: state.profile.environment, isolated, externalWritesEnabled: state.profile.externalWritesEnabled, catalogItems: state.catalog.length, brainRecords: state.brain.length, marketplace: { installable: apps.filter((item) => item.installable).length, plannedInstallRejected: true }, semanticDocuments: semantic.indexed, semanticEvents: state.audit.filter((entry) => entry.action.startsWith("semantic.")).slice(-3), pendingApprovals: state.approvals.length, workflowRuns: state.workflows.length, ai: { provider: ai.provider, model: ai.model, outputTokens: ai.usage.outputTokens, response: ai.text } }, null, 2));
}

try { await run(); }
finally {
  if (child && child.exitCode == null) child.kill();
  if (isolatedRoot) await rm(isolatedRoot, { recursive: true, force: true });
}
