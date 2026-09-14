import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class CredentialVault {
  constructor({ stateFile, keyFile } = {}) { this.stateFile = stateFile; this.keyFile = keyFile; this.entries = {}; this.key = null; }
  async load() { await mkdir(dirname(this.stateFile), { recursive: true }); try { this.entries = JSON.parse(await readFile(this.stateFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; await this.save(); } try { this.key = Buffer.from(await readFile(this.keyFile, "utf8"), "hex"); } catch (error) { if (error.code !== "ENOENT") throw error; this.key = randomBytes(32); await writeFile(this.keyFile, this.key.toString("hex"), { mode: 0o600 }); } }
  async save() { await writeFile(this.stateFile, JSON.stringify(this.entries, null, 2)); }
  async set(ownerId, provider, secret) { if (!String(provider ?? "").trim() || !String(secret ?? "").trim()) throw new Error("Provider and credential are required"); const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", this.key, iv); const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]); this.entries[`${ownerId}:${provider}`] = { iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), value: encrypted.toString("hex"), updatedAt: new Date().toISOString() }; await this.save(); }
  has(ownerId, provider) { return Boolean(this.entries[`${ownerId}:${provider}`]); }
  get(ownerId, provider) { const entry = this.entries[`${ownerId}:${provider}`]; if (!entry) return null; const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(entry.iv, "hex")); decipher.setAuthTag(Buffer.from(entry.tag, "hex")); return Buffer.concat([decipher.update(Buffer.from(entry.value, "hex")), decipher.final()]).toString("utf8"); }
  status(ownerId) { return ["ollama", "ai", "search_console", "wordpress_staging", "google", "whatsapp", "email", "meta", "website"].map((provider) => ({ provider, configured: provider === "ollama" || this.has(ownerId, provider) || (provider === "ai" && this.has(ownerId, "gemini")) })); }
}
