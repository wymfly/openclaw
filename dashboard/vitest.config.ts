import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/": resolve(__dirname, "src") + "/",
      "@server/": resolve(__dirname, "server") + "/",
    },
  },
  test: {
    include: ["server/**/*.test.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "dist/**"],
  },
});
