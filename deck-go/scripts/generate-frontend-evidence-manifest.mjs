#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const deckRoot = path.resolve(path.dirname(thisFile), "..");
const repoRoot = path.resolve(deckRoot, "..");
const auditDir = path.join(deckRoot, "frontend-handoff/audit");
const modulesDir = path.join(deckRoot, "frontend-handoff/modules");
const panelsDir = path.join(deckRoot, "frontend-new/src/components/panels");
const outPath = path.join(auditDir, "module-evidence-manifest.json");
const changeId = "deck-go-frontend-verification-discipline";

const today = process.env.DECK_GO_EVIDENCE_DATE ?? "2026-05-06";

function main() {
  mkdirSync(auditDir, { recursive: true });
  const modules = listDirs(modulesDir);
  const head = exec("git rev-parse HEAD");
  const manifest = {
    schemaVersion: 1,
    generatedForChange: changeId,
    generatedAt: today,
    sourceCommit: head,
    manifestContract: {
      levels: ["mock-functional", "mock-prototype-parity", "real-gateway"],
      statuses: [
        "tracked",
        "ready-for-review",
        "recorded-in-implementation-notes",
        "missing",
        "unreviewed",
        "degraded",
        "skipped-safe",
        "handoff-blocked",
      ],
      note: "Large screenshots and Playwright artifacts stay under ignored .local paths; this tracked manifest records commands, artifact paths, and verdict state.",
    },
    modules: modules.map((module) => buildModuleEntry(module)),
  };

  writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `frontend-evidence-manifest: wrote ${relative(outPath)} (${manifest.modules.length} modules)`,
  );
}

function buildModuleEntry(module) {
  const notesPath = path.join(modulesDir, module, "implementation-notes.md");
  const readmePath = path.join(modulesDir, module, "README.md");
  const prototypePath = path.join(modulesDir, module, "prototype.html");
  const panelPath = path.join(panelsDir, module);
  const notes = existsSync(notesPath) ? readFileSync(notesPath, "utf8") : "";
  const parity = readParity(module);
  const visualSpec = `test/e2e/${module}-visual.spec.ts`;
  const realSpec = `test/e2e/${module}-real-gateway.spec.ts`;
  const hasVisualSpec = existsSync(path.join(deckRoot, visualSpec));
  const hasRealSpec = existsSync(path.join(deckRoot, realSpec));
  const hasRealNotes =
    /Real Gateway evidence|real[- ]contract|L2 real|Real E2E|strengthened real/i.test(notes);
  const parityVerdict = parity?.verdict ?? "missing";
  const finalSignoffStatus =
    parityVerdict === "pass" || parityVerdict === "pass-with-exceptions"
      ? "accepted-with-exceptions"
      : parityVerdict === "unreviewed"
        ? "needs-revision"
        : "blocked";

  return {
    module,
    date: today,
    reviewer: "Codex",
    finalSignoffStatus,
    prototypeReference: existsSync(prototypePath)
      ? relative(prototypePath)
      : `${relative(prototypePath)} (missing)`,
    productionReference: existsSync(panelPath)
      ? relative(panelPath)
      : `${relative(panelPath)} (missing)`,
    readmePath: existsSync(readmePath) ? relative(readmePath) : `${relative(readmePath)} (missing)`,
    implementationNotesPath: existsSync(notesPath)
      ? relative(notesPath)
      : `${relative(notesPath)} (missing)`,
    evidence: [
      {
        level: "mock-functional",
        status: hasVisualSpec ? "tracked" : "missing",
        command: hasVisualSpec
          ? `pnpm exec playwright test ${visualSpec} --config playwright.config.ts`
          : null,
        artifactPath: `.local/${module}-remediation-mock-visual/`,
        verdict: hasVisualSpec ? "recorded-by-visual-spec" : "missing",
        runId: null,
        acceptedExceptions: [],
      },
      {
        level: "mock-prototype-parity",
        status: parity?.evidenceStatus ?? "missing",
        command:
          "node scripts/generate-prototype-parity-report.mjs --prototype-dir .local/prototype-gap-audit --mock-dir <module-mock-visual-dir> --out-dir .local/<module>-prototype-remediation-parity-report --sheet-size 1",
        artifactPath: `.local/${module}-prototype-remediation-parity-report/verdict.json`,
        verdict: parityVerdict,
        runId: null,
        acceptedExceptions: parity?.acceptedExceptions ?? [],
        materialGaps: parity?.materialGaps ?? [],
      },
      {
        level: "real-gateway",
        status: hasRealNotes ? "recorded-in-implementation-notes" : "missing",
        command: hasRealSpec
          ? `DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test ${realSpec} --config playwright.config.ts`
          : null,
        artifactPath: relative(notesPath),
        verdict: hasRealNotes ? "recorded" : "missing",
        runId: extractRunId(notes),
        acceptedExceptions: [],
      },
    ],
  };
}

function readParity(module) {
  const filePath = path.join(
    deckRoot,
    `.local/${module}-prototype-remediation-parity-report/verdict.json`,
  );
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const value = JSON.parse(readFileSync(filePath, "utf8"));
    const rows = Array.isArray(value) ? value : [value];
    return rows.find((row) => row?.module === module) ?? rows[0] ?? null;
  } catch (error) {
    return {
      module,
      evidenceStatus: "missing",
      verdict: "invalid-json",
      acceptedExceptions: [],
      materialGaps: [
        `Failed to parse ${relative(filePath)}: ${error instanceof Error ? error.message : "unknown error"}`,
      ],
    };
  }
}

function extractRunId(text) {
  const match = text.match(/\b(?:runId|run id|run-|r-)([:= ]+)?([a-z0-9][a-z0-9_-]{4,})\b/i);
  return match?.[2] ?? null;
}

function listDirs(dirPath) {
  return readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted((a, b) => a.localeCompare(b));
}

function exec(command) {
  return execSync(command, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function relative(filePath) {
  return path.relative(deckRoot, filePath).replaceAll(path.sep, "/");
}

main();
