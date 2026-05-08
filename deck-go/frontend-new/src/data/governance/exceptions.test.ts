import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dataFabricGovernanceExceptions } from "./exceptions";

type Finding = {
  filePath: string;
  line: number;
  pattern: string;
  text: string;
};

const sourceRoot = path.resolve(process.cwd(), "src");
const scannedRoots = ["components", "hooks", "stores"];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return walk(fullPath);
    }
    return fullPath;
  });
}

function repoRelative(filePath: string) {
  return path.relative(sourceRoot, filePath).split(path.sep).join("/");
}

function lineNumber(text: string, index: number) {
  return text.slice(0, index).split("\n").length;
}

function collectFindings(filePath: string): Finding[] {
  const text = readFileSync(filePath, "utf8");
  const relative = repoRelative(filePath);
  const findings: Finding[] = [];
  const importPattern = /import\s+(type\s+)?\{[\s\S]*?\}\s+from\s+["']([^"']+)["'];/g;
  for (const match of text.matchAll(importPattern)) {
    const isTypeOnly = Boolean(match[1]);
    const source = match[2] ?? "";
    const block = match[0] ?? "";
    if (isTypeOnly) {
      continue;
    }
    if (
      (source === "@/api" || /(^|\/)api$/.test(source)) &&
      /\b(fetch[A-Z]\w*|deckFetch)\b/.test(block)
    ) {
      findings.push({
        filePath: relative,
        line: lineNumber(text, match.index ?? 0),
        pattern: "raw-api-fetch-import",
        text: block,
      });
    }
    if (source === "./chat-api" && /\bfetch[A-Z]\w*\b/.test(block)) {
      findings.push({
        filePath: relative,
        line: lineNumber(text, match.index ?? 0),
        pattern: "chat-adapter-fetch-import",
        text: block,
      });
    }
  }

  const deckFetchPattern = /\bdeckFetch\s*\(/g;
  for (const match of text.matchAll(deckFetchPattern)) {
    findings.push({
      filePath: relative,
      line: lineNumber(text, match.index ?? 0),
      pattern: "raw-deck-fetch-call",
      text: match[0] ?? "deckFetch(",
    });
  }

  const fetchHelperCallPattern = /\bfetch[A-Z]\w*\s*\(/g;
  for (const match of text.matchAll(fetchHelperCallPattern)) {
    const index = match.index ?? 0;
    const previous = index > 0 ? text[index - 1] : "";
    if (previous === "." || /\w/.test(previous)) {
      continue;
    }
    const lineStart = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
    const linePrefix = text.slice(lineStart, index);
    if (/\bfunction\s+$/.test(linePrefix)) {
      continue;
    }
    findings.push({
      filePath: relative,
      line: lineNumber(text, index),
      pattern: "raw-fetch-helper-call",
      text: match[0] ?? "fetch*(",
    });
  }

  const storeFetchMethodPattern = /^\s+(fetch|load|refresh)[A-Z]\w*\s*:\s*(async|\()/gm;
  if (relative.startsWith("stores/")) {
    for (const match of text.matchAll(storeFetchMethodPattern)) {
      findings.push({
        filePath: relative,
        line: lineNumber(text, match.index ?? 0),
        pattern: "store-server-lifecycle-method",
        text: match[0] ?? "",
      });
    }
  }

  return findings;
}

describe("Data Fabric governance exceptions", () => {
  it("documents each exception with owner, reason, and follow-up status", () => {
    for (const entry of dataFabricGovernanceExceptions) {
      expect(entry.filePath).toMatch(/^src\//);
      expect(entry.pattern).toBeTruthy();
      expect(entry.owner).toBeTruthy();
      expect(entry.reason.length).toBeGreaterThan(40);
      expect(["approved", "deferred"]).toContain(entry.followUpStatus);
    }
  });

  it("blocks new unapproved raw server-state lifecycle patterns in panel, hook, and store roots", () => {
    const allowed = new Set(
      dataFabricGovernanceExceptions.map((entry) => `${entry.filePath}:${entry.pattern}`),
    );
    const files = scannedRoots
      .flatMap((root) => walk(path.join(sourceRoot, root)))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => !/\.(test|spec)\.(ts|tsx)$/.test(file));
    const findings = files
      .flatMap(collectFindings)
      .filter((finding) => !allowed.has(`src/${finding.filePath}:${finding.pattern}`));

    expect(
      findings.map(
        (finding) =>
          `${finding.filePath}:${finding.line} ${finding.pattern} ${finding.text.replace(/\s+/g, " ").slice(0, 140)}`,
      ),
    ).toEqual([]);
  });
});
