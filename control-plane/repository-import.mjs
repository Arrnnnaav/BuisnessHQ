import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export function validateRepositoryUrl(repositoryUrl) {
  let url;
  try { url = new URL(repositoryUrl); } catch { throw new Error("repositoryUrl must be a valid HTTPS GitHub URL"); }
  if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) {
    throw new Error("Only HTTPS GitHub repositories are accepted by Plugin Studio.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2 || parts.some((part) => part === "." || part === "..")) throw new Error("repositoryUrl must name a GitHub repository.");
  return `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/, "")}.git`;
}

export async function importRepository({ repositoryUrl, ref = "", importRoot }) {
  const normalized = validateRepositoryUrl(repositoryUrl);
  if (!importRoot) throw new Error("Plugin Studio importRoot is not configured.");
  const id = createHash("sha256").update(`${normalized}\n${ref}`).digest("hex").slice(0, 24);
  const destination = join(importRoot, id);
  await mkdir(importRoot, { recursive: true });
  try {
    await execFileAsync("git", ["-C", destination, "rev-parse", "--verify", "HEAD"], { timeout: 15_000, windowsHide: true });
  } catch {
    await execFileAsync("git", ["clone", "--depth", "1", ...(ref ? ["--branch", ref] : []), normalized, destination], { timeout: 120_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  }
  return { path: destination, repositoryUrl: normalized, ref: ref || "default branch", sourceId: id };
}
