import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const scrypt = promisify(scryptCallback);
const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

export class AuthService {
  constructor({ stateFile } = {}) { this.stateFile = stateFile; this.users = new Map(); this.sessions = new Map(); }

  async load() {
    if (!this.stateFile) return;
    try {
      const state = JSON.parse(await readFile(this.stateFile, "utf8"));
      for (const user of state.users ?? []) this.users.set(user.id, user);
    } catch (error) { if (error.code !== "ENOENT") throw error; await this.save(); }
  }

  async save() { if (this.stateFile) { await mkdir(dirname(this.stateFile), { recursive: true }); await writeFile(this.stateFile, JSON.stringify({ users: [...this.users.values()] }, null, 2)); } }

  hasUsers() { return this.users.size > 0; }

  async register({ name, email, password }) {
    const normalizedEmail = normalizeEmail(email);
    if (!String(name ?? "").trim()) throw new Error("Owner name is required");
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("A valid email address is required");
    if (String(password ?? "").length < 12) throw new Error("Use a password with at least 12 characters");
    if ([...this.users.values()].some((user) => user.email === normalizedEmail)) throw new Error("An account already exists for this email");
    const salt = randomBytes(16).toString("hex");
    const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
    const user = { id: randomUUID(), name: name.trim(), email: normalizedEmail, passwordHash, salt, createdAt: new Date().toISOString() };
    this.users.set(user.id, user); await this.save();
    return { user: this.publicUser(user), session: this.#createSession(user.id) };
  }

  async login({ email, password }) {
    const user = [...this.users.values()].find((candidate) => candidate.email === normalizeEmail(email));
    if (!user) throw new Error("Invalid email or password");
    const candidateHash = Buffer.from(await scrypt(password, user.salt, 64));
    const storedHash = Buffer.from(user.passwordHash, "hex");
    if (candidateHash.length !== storedHash.length || !timingSafeEqual(candidateHash, storedHash)) throw new Error("Invalid email or password");
    return { user: this.publicUser(user), session: this.#createSession(user.id) };
  }

  async resetOwner({ name, email, password }) {
    const normalizedEmail = normalizeEmail(email);
    if (!String(name ?? "").trim()) throw new Error("Owner name is required");
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("A valid email address is required");
    if (String(password ?? "").length < 12) throw new Error("Use a password with at least 12 characters");
    const current = this.users.values().next().value;
    if (!current) return this.register({ name, email: normalizedEmail, password });
    const salt = randomBytes(16).toString("hex");
    const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
    const user = { ...current, name: name.trim(), email: normalizedEmail, passwordHash, salt };
    this.users.clear(); this.users.set(user.id, user); this.sessions.clear(); await this.save();
    return { user: this.publicUser(user) };
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = this.users.get(userId);
    if (!user) throw new Error("Owner account not found");
    const candidateHash = Buffer.from(await scrypt(String(currentPassword ?? ""), user.salt, 64));
    const storedHash = Buffer.from(user.passwordHash, "hex");
    if (candidateHash.length !== storedHash.length || !timingSafeEqual(candidateHash, storedHash)) throw new Error("Current password is incorrect");
    if (String(newPassword ?? "").length < 12) throw new Error("Use a new password with at least 12 characters");
    const salt = randomBytes(16).toString("hex");
    user.passwordHash = (await scrypt(newPassword, salt, 64)).toString("hex");
    user.salt = salt;
    this.sessions.clear();
    await this.save();
    return this.publicUser(user);
  }

  authenticate(token) {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt < Date.now()) return null;
    const user = this.users.get(session.userId);
    return user ? this.publicUser(user) : null;
  }

  logout(token) { this.sessions.delete(token); }
  publicUser(user) { return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }; }
  #createSession(userId) { const token = randomBytes(32).toString("base64url"); this.sessions.set(token, { userId, expiresAt: Date.now() + 1000 * 60 * 60 * 12 }); return { token, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString() }; }
}
