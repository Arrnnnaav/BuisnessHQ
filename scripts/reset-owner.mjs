import { resolve } from "node:path";
import { AuthService } from "../core/auth/auth-service.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (value.startsWith("--")) args.set(value.slice(2), process.argv[index + 1] && !process.argv[index + 1].startsWith("--") ? process.argv[++index] : true);
}

if (args.get("help") || !args.get("confirm")) {
  console.log("Usage: node scripts/reset-owner.mjs --name \"Owner\" --email owner@example.com --password \"12+ chars\" --confirm RESET-OWNER");
  console.log("Updates the single owner credentials while preserving company, catalog, brain, and audit data.");
  process.exit(args.get("help") ? 0 : 1);
}
if (args.get("confirm") !== "RESET-OWNER") throw new Error("Confirmation must be exactly RESET-OWNER");
const auth = new AuthService({ stateFile: resolve(process.env.BUSINESSOS_DATA_ROOT ?? "data", "auth.json") });
await auth.load();
const result = await auth.resetOwner({ name: args.get("name"), email: args.get("email"), password: args.get("password") });
console.log(`Owner access updated for ${result.user.email}. Existing company data was preserved.`);
