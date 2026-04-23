import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const deckGoRoot = new URL("../", import.meta.url);
const rootPath = deckGoRoot.pathname;

const ignoredDirNames = new Set(["frontend-next", "docs", "node_modules", "dist", ".next", ".omx"]);

const ignoredFileNames = new Set(["package-lock.json", "tsconfig.tsbuildinfo"]);
const textFileExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".go",
  ".sh",
  ".yml",
  ".yaml",
  ".toml",
]);

const forbiddenPatterns = [
  { label: "frontend-next reference", regex: /\bfrontend-next\b/ },
  { label: "next build reference", regex: /\bnext build\b/ },
  { label: "next dev reference", regex: /\bnext dev\b/ },
  { label: "next start reference", regex: /\bnext start\b/ },
  { label: "legacy VITE_API_BASE contract", regex: /\bVITE_API_BASE\b/ },
];

const hits = [];

function walk(currentPath) {
  for (const entry of readdirSync(currentPath)) {
    if (ignoredDirNames.has(entry)) {
      continue;
    }

    const nextPath = path.join(currentPath, entry);
    const stat = statSync(nextPath);
    if (stat.isDirectory()) {
      walk(nextPath);
      continue;
    }

    if (ignoredFileNames.has(entry)) {
      continue;
    }

    if (!textFileExtensions.has(path.extname(entry))) {
      continue;
    }

    const relativePath = path.relative(rootPath, nextPath);
    if (relativePath === "scripts/check-active-host-paths.mjs") {
      continue;
    }
    const source = readFileSync(nextPath, "utf8");

    for (const pattern of forbiddenPatterns) {
      if (pattern.regex.test(source)) {
        hits.push(`${relativePath}: ${pattern.label}`);
      }
    }
  }
}

walk(rootPath);

if (hits.length > 0) {
  console.error("[active-host-check] active deck-go paths still reference the retired Next host:");
  for (const hit of hits) {
    console.error(`- ${hit}`);
  }
  process.exit(1);
}

console.log(
  "[active-host-check] verified no active deck-go paths reference frontend-next or Next host commands",
);
