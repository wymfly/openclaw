import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const currentFile = fileURLToPath(import.meta.url);
const srcRoot = join(here, "..", "..");
const appApiRoot = join(srcRoot, "app", "api");
const frontendRoot = join(srcRoot, "..");
const retiredServerRuntimeCluster = [
  "server/alert-engine.ts",
  "server/approval-bridge.ts",
  "server/budget-alert-stores.ts",
  "server/contracts.ts",
  "server/deck-settings.ts",
  "server/device-identity.ts",
  "server/event-bus.ts",
  "server/gateway-adapter.ts",
  "server/gateway-allowlist.ts",
  "server/gateway-errors.ts",
  "server/health-poller.ts",
  "server/node-connection.ts",
  "server/rate-limit.ts",
  "server/runtime.ts",
] as const;

const allowedControlPlaneBaseReaders = new Set(["lib/deck-go-base.ts"]);

const allowedDeckHeaderShells = new Set(["lib/deck-client.ts"]);

const allowedControlPlaneBaseImporters = new Set(["lib/deck-client.ts"]);

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
  it("keeps deleted route-era helper shells removed", () => {
    const deletedHelpers = [
      join(srcRoot, "middleware.ts"),
      join(srcRoot, "app", "api", "_deck-go-proxy.ts"),
      join(srcRoot, "lib", "api-helpers.ts"),
      join(srcRoot, "lib", "with-auth.ts"),
      join(srcRoot, "lib", "transcript-history.ts"),
      join(srcRoot, "lib", "gateway-http.ts"),
      join(srcRoot, "lib", "json-store.ts"),
      join(srcRoot, "lib", "plugin-locales.ts"),
      join(srcRoot, "lib", "subscription-manager.ts"),
      join(srcRoot, "lib", "webhooks.ts"),
    ];

    const stillPresent = deletedHelpers
      .filter((file) => existsSync(file))
      .map((file) => relative(srcRoot, file));

    expect(stillPresent).toEqual([]);
  });

  it("keeps the retained host-shell allowlist explicit", () => {
    const sourceFiles = collectFiles(
      srcRoot,
      (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
    );
    const unexpectedControlPlaneBaseReaders: string[] = [];
    const unexpectedDeckHeaderShells: string[] = [];
    const unexpectedGatewayLoopbackShells: string[] = [];

    for (const file of sourceFiles) {
      const rel = relative(srcRoot, file);
      const source = readFileSync(file, "utf8");
      const hasDeckHeaderWiring =
        /\[\s*"authorization",\s*"x-deck-token",\s*"last-event-id"/.test(source) ||
        /\.set\("x-deck-token"/.test(source) ||
        /\.set\("Last-Event-ID"/.test(source);

      if (
        /process\.env\.(?:DECK_GO_API_BASE|NEXT_PUBLIC_DECK_GO_API_BASE)\b/.test(source) &&
        !allowedControlPlaneBaseReaders.has(rel)
      ) {
        unexpectedControlPlaneBaseReaders.push(rel);
      }

      if (hasDeckHeaderWiring && !allowedDeckHeaderShells.has(rel)) {
        unexpectedDeckHeaderShells.push(rel);
      }

      if (
        /process\.env\.DECK_GATEWAY_(?:URL|TOKEN)\b/.test(source) ||
        /NextResponse\.rewrite\(/.test(source)
      ) {
        unexpectedGatewayLoopbackShells.push(rel);
      }
    }

    expect(unexpectedControlPlaneBaseReaders).toEqual([]);
    expect(unexpectedDeckHeaderShells).toEqual([]);
    expect(unexpectedGatewayLoopbackShells).toEqual([]);
  });

  it("keeps the shared Deck Go base helper scoped to the retained host shells", () => {
    const sourceFiles = collectFiles(
      srcRoot,
      (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
    );
    const invalidImporters: string[] = [];

    for (const file of sourceFiles) {
      const rel = relative(srcRoot, file);
      if (rel === "lib/deck-go-base.ts") {
        continue;
      }

      const source = readFileSync(file, "utf8");
      if (!/from ["']@\/lib\/deck-go-base["']/.test(source)) {
        continue;
      }

      if (!allowedControlPlaneBaseImporters.has(rel)) {
        invalidImporters.push(rel);
      }
    }

    expect(invalidImporters).toEqual([]);
  });

  it("does not reintroduce removed local Gateway loopback helpers", () => {
    const sourceFiles = collectFiles(
      srcRoot,
      (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
    );
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      if (
        !/from ["']@\/lib\/gateway-http["']/.test(source) &&
        !/NextResponse\.rewrite\(/.test(source) &&
        !/process\.env\.DECK_GATEWAY_(?:URL|TOKEN)\b/.test(source)
      ) {
        continue;
      }
      offenders.push(relative(srcRoot, file));
    }

    expect(offenders).toEqual([]);
  });

  it("keeps production src code free of @server imports", () => {
    const sourceFiles = collectFiles(
      srcRoot,
      (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
    );
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      if (!/from ["']@server\//.test(source)) {
        continue;
      }
      offenders.push(relative(srcRoot, file));
    }

    expect(offenders).toEqual([]);
  });

  it("keeps production src code off raw same-origin /api fetch calls", () => {
    const sourceFiles = collectFiles(
      srcRoot,
      (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
    );
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      if (!/\bfetch\(\s*["'`]\/api\//.test(source)) {
        continue;
      }
      offenders.push(relative(srcRoot, file));
    }

    expect(offenders).toEqual([]);
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

  it("does not restore the retired app/api compatibility layer", () => {
    expect(existsSync(appApiRoot)).toBe(false);
    expect(existsSync(join(srcRoot, "app", "api", "_deck-go-proxy.ts"))).toBe(false);
  });

  it("does not restore the retired @server alias surface", () => {
    const tsconfig = readFileSync(join(frontendRoot, "tsconfig.json"), "utf8");
    const vitestConfig = readFileSync(join(frontendRoot, "vitest.config.ts"), "utf8");

    expect(tsconfig).not.toContain('"@server/*"');
    expect(vitestConfig).not.toContain('"@server/"');
    expect(existsSync(join(frontendRoot, "server", "index.ts"))).toBe(false);
  });

  it("does not restore retired orphan server seams", () => {
    expect(existsSync(join(frontendRoot, "server", "access-gate.ts"))).toBe(false);
    expect(existsSync(join(frontendRoot, "server", "run-aggregator.ts"))).toBe(false);
    for (const rel of retiredServerRuntimeCluster) {
      expect(existsSync(join(frontendRoot, rel))).toBe(false);
    }
  });
});
