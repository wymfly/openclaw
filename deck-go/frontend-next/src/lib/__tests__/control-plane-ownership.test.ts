import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const currentFile = fileURLToPath(import.meta.url);
const srcRoot = join(here, "..", "..");
const appApiRoot = join(srcRoot, "app", "api");

const forbiddenRoutePatterns = [
  /\bgwRequest\(/,
  /\bgatewayRequest\(/,
  /\bgwCall\(/,
  /\bwithAuth\(/,
];

const forbiddenRouteImports = [
  /from "@server\/runtime"/,
  /from "@server\/access-gate"/,
  /from "@server\/gateway-adapter"/,
  /from "node:(fs|path|os)"/,
];

function collectFiles(root: string, predicate: (file: string) => boolean): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("frontend-next control-plane ownership", () => {
  it("keeps app/api route handlers free of local runtime fallback helpers", () => {
    const routeFiles = collectFiles(appApiRoot, (file) => file.endsWith("route.ts"));
    const offenders: string[] = [];

    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      if (forbiddenRoutePatterns.some((pattern) => pattern.test(source))) {
        offenders.push(relative(srcRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps app/api route handlers on the control-plane proxy path", () => {
    const routeFiles = collectFiles(appApiRoot, (file) => file.endsWith("route.ts"));
    const missingProxyHelper: string[] = [];
    const forbiddenImports: string[] = [];

    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("fetchDeckGo(") && !source.includes("maybeProxyToDeckGo(")) {
        missingProxyHelper.push(relative(srcRoot, file));
      }
      if (forbiddenRouteImports.some((pattern) => pattern.test(source))) {
        forbiddenImports.push(relative(srcRoot, file));
      }
    }

    expect(missingProxyHelper).toEqual([]);
    expect(forbiddenImports).toEqual([]);
  });

  it("keeps deleted route-era helper shells removed", () => {
    const deletedHelpers = [
      join(srcRoot, "lib", "api-helpers.ts"),
      join(srcRoot, "lib", "with-auth.ts"),
      join(srcRoot, "lib", "transcript-history.ts"),
    ];

    const stillPresent = deletedHelpers
      .filter((file) => existsSync(file))
      .map((file) => relative(srcRoot, file));

    expect(stillPresent).toEqual([]);
  });

  it("does not reference the removed deck subagent lineage pseudo-route", () => {
    const sourceFiles = collectFiles(srcRoot, (file) => {
      if (!/\.(ts|tsx)$/.test(file)) {
        return false;
      }
      const stats = statSync(file);
      return stats.isFile();
    });
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      if (file === currentFile) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (source.includes("/api/deck/subagents/lineage")) {
        offenders.push(relative(srcRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
