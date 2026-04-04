#!/usr/bin/env tsx
/**
 * Protocol coverage check — reports typed vs untyped Gateway method usage in dashboard.
 */
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { allMethodDefs, allMethodNames } from "../src/gateway/method-registry-data.js";

const ROOT = resolve(import.meta.dirname, "..");
const DASHBOARD_ROOT = join(ROOT, "dashboard/src");

const typedMethods = new Set(
  Object.entries(allMethodDefs)
    .filter(([, def]) => def.params && def.result)
    .map(([method]) => method),
);

const grepOutput = execSync(`grep -roh 'gatewayRequest("[^"]*"' "${DASHBOARD_ROOT}" || true`, {
  encoding: "utf-8",
});

const untypedMethods = new Set<string>();
for (const match of grepOutput.matchAll(/gatewayRequest\("([^"]+)"/g)) {
  untypedMethods.add(match[1]);
}

for (const method of typedMethods) {
  untypedMethods.delete(method);
}

const families = new Map<string, { typed: string[]; untyped: string[]; notCovered: string[] }>();

for (const name of allMethodNames) {
  const family = name.split(".").slice(0, 2).join(".");
  if (!families.has(family)) {
    families.set(family, { typed: [], untyped: [], notCovered: [] });
  }

  const entry = families.get(family);
  if (!entry) {
    continue;
  }

  if (typedMethods.has(name)) {
    entry.typed.push(name);
  } else if (untypedMethods.has(name)) {
    entry.untyped.push(name);
  } else {
    entry.notCovered.push(name);
  }
}

console.log("=== Protocol Coverage Report ===\n");
console.log(`Total registered methods: ${allMethodNames.length}`);
console.log(`Typed (params + result): ${typedMethods.size}`);
console.log(`Untyped (gatewayRequest only): ${untypedMethods.size}`);
console.log(
  `Not covered by dashboard: ${allMethodNames.length - typedMethods.size - untypedMethods.size}\n`,
);

console.log("--- By Family ---");
for (const [family, counts] of [...families.entries()].toSorted((a, b) =>
  a[0].localeCompare(b[0]),
)) {
  const typedCount = counts.typed.length;
  const untypedCount = counts.untyped.length;
  const notCoveredCount = counts.notCovered.length;
  console.log(
    `  ${family}: typed=${typedCount} untyped=${untypedCount} not-covered=${notCoveredCount}`,
  );
}

if (untypedMethods.size > 0) {
  console.log(`\nUntyped methods:\n  ${[...untypedMethods].toSorted().join("\n  ")}`);
}
