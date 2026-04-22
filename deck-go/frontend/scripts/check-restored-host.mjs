import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const frontendRoot = new URL("..", import.meta.url);

function read(relativePath) {
  return readFileSync(new URL(relativePath, frontendRoot), "utf8");
}

function walkFiles(relativePath) {
  const basePath = new URL(relativePath, frontendRoot);
  const results = [];

  function visit(currentPath) {
    for (const entry of readdirSync(currentPath)) {
      const nextPath = path.join(currentPath, entry);
      const stat = statSync(nextPath);
      if (stat.isDirectory()) {
        visit(nextPath);
        continue;
      }
      results.push(nextPath);
    }
  }

  visit(basePath.pathname);
  return results;
}

function fail(message) {
  console.error(`[restored-host-check] ${message}`);
  process.exitCode = 1;
}

const registry = read("src/restoration/panel-registry.tsx");
const host = read("src/restoration/ActivePanelHost.tsx");
const readiness = read("src/restoration/contract-readiness.ts");

const registryIds = Array.from(registry.matchAll(/\bid:\s*"([^"]+)"/g), (match) => match[1]);
const handledIds = new Set(
  Array.from(host.matchAll(/entry\.id === "([^"]+)"/g), (match) => match[1]),
);

const missingHandlers = registryIds.filter((id) => !handledIds.has(id));
if (missingHandlers.length > 0) {
  fail(`missing ActivePanelHost handlers for panel ids: ${missingHandlers.join(", ")}`);
}

const blockedMatches = readiness.match(/\bstatus:\s*"frontend-blocked"/g) ?? [];
if (blockedMatches.length > 0) {
  fail(`contract-readiness still contains ${blockedMatches.length} frontend-blocked entries`);
}

const panelFiles = walkFiles("src/restoration/panels").filter(
  (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
);
const badHelperHits = [];

for (const filePath of panelFiles) {
  const source = readFileSync(filePath, "utf8");
  if (source.includes(".toSorted(")) {
    badHelperHits.push(`${path.relative(frontendPathname(), filePath)} uses toSorted`);
  }
  if (source.includes("reduce((sum, value)")) {
    badHelperHits.push(
      `${path.relative(frontendPathname(), filePath)} uses an untyped reduce accumulator`,
    );
  }
}

if (badHelperHits.length > 0) {
  fail(badHelperHits.join("; "));
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(
  `[restored-host-check] verified ${registryIds.length} panel ids, 0 frontend-blocked entries, and compile-safe panel helpers`,
);

function frontendPathname() {
  return frontendRoot.pathname;
}
