import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { analyzeRepository } from "../core/plugins/repository-analyzer.mjs";
import { declaredPermissions, validatePluginContract } from "../core/plugins/universal-plugin-contract.mjs";

// The publishing pipeline (operator plan sections 4 and 11).
//
// This is where the GitHub importer and repository analyzer belong: in our console, behind
// a gate, not in a business owner's Marketplace. A repository becomes a published plugin
// only by passing every stage below, in order.
//
// The pipeline stops at the first failed stage rather than collecting warnings, because a
// package that fails a permission scan should never reach the packaging step at all.

// Permissions a plugin may not hold without an explicit human decision. These are the ones
// that let a plugin reach outside the machine or read another plugin's data.
// Both vocabularies in use are covered: the contract's dotted names ("system.shell") and
// the colon form the bundled plugins use ("execute:external_publish").
const HIGH_RISK_PERMISSIONS = [
  /^network(\.|:|$)/i,          // reaches outside the machine
  /^system(\.|:)/i,             // shell and process control
  /^process(\.|:)/i,
  /^exec(ute)?:external/i,      // acts on a third-party service
  /^write:external/i,
  /^secrets?(\.|:)/i,           // reads stored credentials
  /^read:(credentials?|vault)/i,
  /^write:(credentials?|vault)/i,
  /^filesystem\.write/i,
  /^admin(\.|:)/i,
  /^\*$/,                       // asks for everything
];

// Patterns that suggest a package is doing something a declared manifest would not reveal.
// A hit is not proof of malice; it is a reason to require review before publishing.
const SUSPICIOUS_CODE = [
  { pattern: /\bchild_process\b|\bexecSync\b|\bspawnSync\b/, reason: "runs operating system commands" },
  { pattern: /\beval\s*\(|new\s+Function\s*\(/, reason: "evaluates code at runtime" },
  { pattern: /process\.env\.[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)/, reason: "reads credentials from the environment" },
  { pattern: /\.vault-key|credential-vault|auth\.json/, reason: "references the credential vault" },
];

const SKIP_DIRS = new Set([".git", "node_modules", ".venv", "__pycache__", "dist", "build"]);
const TEXT_FILE = /\.(m?js|cjs|ts|tsx|jsx|json|py|md|txt|ya?ml|html|css)$/i;
const MAX_FILE_BYTES = 512 * 1024;

async function collectFiles(root, base = root, out = {}) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) { await collectFiles(full, base, out); continue; }
    if (!TEXT_FILE.test(entry.name)) continue;
    const info = await stat(full);
    if (info.size > MAX_FILE_BYTES) continue;
    out[relative(base, full).split(sep).join("/")] = await readFile(full, "utf8");
  }
  return out;
}

// Detail is spread first so a detail field can never overwrite the verdict — the tests
// stage reports its own `passed`, which previously clobbered the one computed here.
const stage = (name, passed, detail = {}) => ({ ...detail, stage: name, passed });

export class PublishingPipeline {
  constructor({ registry, sandbox, audit } = {}) {
    this.registry = registry;
    this.sandbox = sandbox;
    this.audit = audit;
  }

  // Runs every check and returns a report. Nothing is published here — publishing is a
  // separate, deliberate call, so a human sees the report first.
  async inspect(root, { pluginId, version, channel = "development", requestedOutcome = "" } = {}) {
    const stages = [];
    const fail = (report) => ({ ok: false, stages, report });

    // 1. Analyze
    const analysis = await analyzeRepository(root);
    stages.push(stage("analyze", analysis.compatibility.level > 0, {
      compatibility: analysis.compatibility,
      detected: Object.entries(analysis.signals).filter(([, value]) => value).map(([key]) => key),
    }));
    if (analysis.compatibility.level === 0) {
      return fail("No supported plugin interface was found in this repository.");
    }

    // 2. Manifest
    const manifest = analysis.declaredPlugin;
    if (!manifest) {
      stages.push(stage("manifest", false));
      return fail("This repository has no plugin.json. Generate a manifest before publishing.");
    }
    const contract = validatePluginContract(manifest);
    stages.push(stage("manifest", contract.valid, { errors: contract.errors ?? [] }));
    if (!contract.valid) return fail(`The manifest is not valid: ${contract.errors.join(", ")}`);

    const id = pluginId ?? manifest.id;
    const releaseVersion = version ?? manifest.version;
    if (!id || !releaseVersion) {
      stages.push(stage("identity", false));
      return fail("The manifest needs an id and a version.");
    }

    // 3. Permission scan
    const requested = declaredPermissions(manifest);
    const highRisk = requested.filter((permission) => HIGH_RISK_PERMISSIONS.some((rule) => rule.test(permission)));
    stages.push(stage("permissions", true, { requested, highRisk, needsReview: highRisk.length > 0 }));

    // 4. Source scan
    const files = await collectFiles(root);
    const findings = [];
    for (const [path, content] of Object.entries(files)) {
      for (const { pattern, reason } of SUSPICIOUS_CODE) {
        if (pattern.test(content)) findings.push({ path, reason });
      }
    }
    stages.push(stage("source-scan", true, { fileCount: Object.keys(files).length, findings, needsReview: findings.length > 0 }));

    // 5. Sandbox tests. A plugin that ships tests must pass them; one that ships none is
    // reported as untested rather than quietly treated as passing.
    let tests = { ran: false, passed: null, reason: "This plugin ships no tests." };
    if (this.sandbox?.runTests) {
      try {
        const result = await this.sandbox.runTests({ root, pluginId: id });
        tests = { ran: true, passed: Boolean(result?.passed), output: result?.output ?? "" };
      } catch (error) {
        tests = { ran: true, passed: false, output: error.message };
      }
    }
    // Untested is not the same as passing. It does not block a publish, but it is put in
    // front of a human rather than rendered as a green tick.
    stages.push(stage("tests", tests.passed !== false, { ...tests, needsReview: !tests.ran || tests.passed !== true }));
    if (tests.passed === false) return fail("The plugin's own tests failed.");

    const blocking = stages.filter((item) => !item.passed);
    const review = stages.filter((item) => item.needsReview);

    return {
      ok: blocking.length === 0,
      pluginId: id,
      version: releaseVersion,
      channel,
      requestedOutcome,
      manifest,
      files,
      stages,
      // Distinct from a failure: these are things a person must look at, not things the
      // pipeline can decide.
      needsReview: review.map((item) => item.stage),
      report: blocking.length ? "One or more checks failed." : review.length ? "Passed, with findings that need review." : "All checks passed.",
    };
  }

  // Publishing is explicit and separate. `approvedBy` is required when the inspection
  // raised anything for review, so a high-risk permission cannot slip through unnoticed.
  async publish(inspection, { channel, approvedBy = null, notes = "" } = {}) {
    if (!inspection?.ok) throw new Error(inspection?.report ?? "This plugin did not pass inspection.");
    if (inspection.needsReview.length && !approvedBy) {
      throw new Error(`This plugin needs review before publishing (${inspection.needsReview.join(", ")}). Publish again naming who approved it.`);
    }

    const manifest = inspection.manifest;
    await this.registry.registerPlugin({
      id: inspection.pluginId,
      name: manifest.name ?? inspection.pluginId,
      description: manifest.description ?? "",
      category: manifest.category,
      publisher: manifest.author?.name ?? "BusinessOS",
    });

    const release = await this.registry.publishVersion({
      pluginId: inspection.pluginId,
      version: inspection.version,
      files: inspection.files,
      channel: channel ?? inspection.channel,
      minimumCoreVersion: manifest.businessos?.minVersion ?? "0.1.0",
      dependencies: manifest.dependencies ?? [],
      permissions: declaredPermissions(manifest),
      capabilities: manifest.capabilities ?? [],
      notes,
    });

    this.audit?.record({
      action: "registry.published", pluginId: inspection.pluginId, version: inspection.version,
      channel: release.channel, approvedBy, needsReview: inspection.needsReview,
    });

    return release;
  }
}

export { HIGH_RISK_PERMISSIONS, SUSPICIOUS_CODE };
