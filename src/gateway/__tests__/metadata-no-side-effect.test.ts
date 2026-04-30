import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("gateway method metadata manifest", () => {
  it("imports without observable stdout or stderr side effects", () => {
    const result = spawnSync(
      "bun",
      ["-e", 'import("./src/gateway/server-methods/_method-defs.generated.ts")'],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});
