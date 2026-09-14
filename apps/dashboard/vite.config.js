import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The build output is a plain static bundle served by apps/server.mjs. No extra runtime
// process ships with the product (see spec R4).
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:4173" } },
});
