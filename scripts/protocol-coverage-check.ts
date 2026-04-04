#!/usr/bin/env tsx
/**
 * Protocol coverage check — reports typed vs untyped Gateway method usage in dashboard.
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { allMethodDefs, allMethodNames } from "../src/gateway/method-registry-data.js";
import {
  buildProtocolCoverageReport,
  collectProtocolMethodUsageFromSource,
  mergeProtocolMethodUsage,
} from "./lib/protocol-coverage-report.ts";

const ROOT = resolve(import.meta.dirname, "..");
const DASHBOARD_ROOT = join(ROOT, "dashboard/src");

function listDashboardSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listDashboardSourceFiles(fullPath));
      continue;
    }

    const extension = extname(entry.name);
    if (extension === ".ts" || extension === ".tsx") {
      files.push(fullPath);
    }
  }
  return files;
}

const typedSchemaMethods = new Set(
  Object.entries(allMethodDefs)
    .filter(([, def]) => def.params || def.result)
    .map(([method]) => method),
);
const usage = mergeProtocolMethodUsage(
  listDashboardSourceFiles(DASHBOARD_ROOT).map((filePath) =>
    collectProtocolMethodUsageFromSource(readFileSync(filePath, "utf-8")),
  ),
);
const report = buildProtocolCoverageReport({
  allMethodNames,
  typedSchemaMethods,
  typedUsedMethods: usage.typedUsedMethods,
  untypedUsedMethods: usage.untypedUsedMethods,
  directUsedMethods: usage.directUsedMethods,
});

console.log("=== Protocol Coverage Report ===\n");
console.log(`Total registered methods: ${report.summary.total}`);
console.log(`Schema-backed methods: ${report.typedSchemaMethods.length}`);
console.log(`Methods used via gwRequest: ${report.typedMethods.length}`);
console.log(`Methods used via gatewayRequest: ${report.untypedMethods.length}`);
console.log(`Methods touched by raw adapter calls: ${report.directMethods.length}`);
console.log(`Primary typed coverage: ${report.summary.typed}`);
console.log(`Primary untyped coverage: ${report.summary.untyped}`);
console.log(`Primary direct-only coverage: ${report.summary.direct}`);
console.log(`Not covered by dashboard: ${report.summary.notCovered}\n`);

console.log("--- By Family ---");
for (const counts of report.families) {
  const typedCount = counts.typed.length;
  const untypedCount = counts.untyped.length;
  const directCount = counts.direct.length;
  const notCoveredCount = counts.notCovered.length;
  console.log(
    `  ${counts.family}: typed=${typedCount} untyped=${untypedCount} direct=${directCount} not-covered=${notCoveredCount}`,
  );
}

if (report.untypedMethods.length > 0) {
  console.log(`\nUntyped methods:\n  ${report.untypedMethods.join("\n  ")}`);
}

if (report.directMethods.length > 0) {
  console.log(`\nDirect adapter methods:\n  ${report.directMethods.join("\n  ")}`);
}

if (report.typedWithoutSchemaMethods.length > 0) {
  console.log(
    `\nTyped calls without schema-backed metadata:\n  ${report.typedWithoutSchemaMethods.join("\n  ")}`,
  );
}

if (report.unknownUsedMethods.length > 0) {
  console.log(`\nUnknown dashboard methods:\n  ${report.unknownUsedMethods.join("\n  ")}`);
}
