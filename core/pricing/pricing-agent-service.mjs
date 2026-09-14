import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export class PricingAgentService {
  constructor({ projectRoot, dataRoot, python = process.platform === "win32" ? "py" : "python3", runner = execFile } = {}) {
    this.projectRoot = projectRoot;
    this.dataRoot = dataRoot;
    this.python = python;
    this.runner = runner;
  }

  validateCatalog(catalog) {
    const eligible = catalog.filter((item) => Number(item.price) > 0 && Number(item.cost) > 0);
    if (!eligible.length) throw new Error("Pricing staging needs at least one catalog item with a verified selling price and cost");
    return eligible.map((item) => ({ ...item, stock: Number.isInteger(item.stock) ? item.stock : 100 }));
  }

  async stage(ownerId, catalog) {
    const products = this.validateCatalog(catalog);
    const runId = randomUUID(); const root = resolve(this.dataRoot, "pricing_agent", ownerId, runId);
    const catalogFile = resolve(root, "catalog.json"); const databaseFile = resolve(root, "staging.db"); const outputFile = resolve(root, "results.json");
    await mkdir(root, { recursive: true }); await writeFile(catalogFile, JSON.stringify(products, null, 2));
    const script = resolve(this.projectRoot, "plugins", "pricing_agent", "scripts", "stage.py");
    const versionArgs = process.platform === "win32" && this.python === "py" ? ["-3.12"] : [];
    const { stdout = "", stderr = "" } = await this.runner(this.python, [...versionArgs, script, "--catalog", catalogFile, "--database", databaseFile, "--output", outputFile], { cwd: this.projectRoot, windowsHide: true });
    const result = JSON.parse(await readFile(outputFile, "utf8"));
    return { id: runId, ...result, catalogFile, databaseFile, outputFile, stdout: stdout.trim(), stderr: stderr.trim(), createdAt: new Date().toISOString() };
  }
}
