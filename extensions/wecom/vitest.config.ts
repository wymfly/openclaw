import baseConfig from "../../vitest.config.ts";

const baseTest = (baseConfig as { test?: { exclude?: string[] } }).test ?? {};
const exclude = baseTest.exclude ?? [];

export default {
  ...(baseConfig as object),
  test: {
    ...baseTest,
    include: ["extensions/wecom/src/**/*.test.ts"],
    exclude,
  },
};
