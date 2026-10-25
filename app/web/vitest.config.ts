import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // Unit tests only; the browser tests in e2e/ run with npm run e2e.
  test: { include: ["**/*.test.ts"], exclude: ["node_modules/**", "e2e/**", ".next*/**"] },
});
