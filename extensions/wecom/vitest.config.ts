import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extensions/wecom/src/**/*.test.ts"],
  },
});
