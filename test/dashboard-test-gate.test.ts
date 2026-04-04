import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("dashboard test merge gate", () => {
  it("registers a root script for dashboard tests", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["test:dashboard"]).toBe("pnpm --dir dashboard test");
  });

  it("runs dashboard tests in CI", () => {
    const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain("command: pnpm test:dashboard");
  });
});
