#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const deckRoot = path.resolve(path.dirname(thisFile), "..");
const repoRoot = path.resolve(deckRoot, "..");
const modulesDir = path.join(deckRoot, "frontend-handoff/modules");
const panelsDir = path.join(deckRoot, "frontend-new/src/components/panels");
const atomsDir = path.join(deckRoot, "frontend-new/src/design-system/atoms");
const auditDir = path.join(deckRoot, "frontend-handoff/audit");
const manifestPath = path.join(auditDir, "module-evidence-manifest.json");
const classificationPath = path.join(auditDir, "frontend-verification-classifications.json");
const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const writeJsonPath = getArgValue("--write-json");

const validNonImplementedStatus = [
  /^ready-for-implementation$/,
  /^revised v\d+ — pending implementation$/,
  /^migrated \(sha [a-f0-9]{40}\)$/,
  /^lite-handoff$/,
];

function main() {
  const modules = listDirs(modulesDir);
  const panels = listDirs(panelsDir);
  const classifications = readJson(classificationPath, emptyClassifications());
  const manifest = readJson(manifestPath, null);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    modules: {
      count: modules.length,
      names: modules,
    },
    panels: {
      count: panels.length,
      names: panels,
    },
    readmeStatus: scanReadmeStatuses(modules),
    reverseSignoff: scanReverseSignoff(modules),
    tokenMirror: runTokenMirrorCheck(),
    panelTokens: scanPanelTokens(panels, classifications),
    a11y: scanA11y(panels, classifications),
    sharedLists: scanSharedLists(classifications),
    evidenceManifest: scanEvidenceManifest(modules, manifest),
    blockers: [],
    warnings: [],
  };

  collectBlockers(report);

  if (writeJsonPath) {
    writeFileSync(path.resolve(deckRoot, writeJsonPath), `${JSON.stringify(report, null, 2)}\n`);
  }

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (report.blockers.length > 0) {
    process.exit(1);
  }
}

function scanReadmeStatuses(modules) {
  const rows = modules.map((module) => {
    const readme = readFileSync(path.join(modulesDir, module, "README.md"), "utf8");
    const line = readme.split(/\r?\n/).find((entry) => entry.startsWith("**Status"));
    const value = parseStatusValue(line);
    const implementedMatch = value.match(/^implemented \(sha ([a-f0-9]{40})\)$/);
    const valid =
      Boolean(implementedMatch) || validNonImplementedStatus.some((pattern) => pattern.test(value));
    const commitExists = implementedMatch ? gitCommitExists(implementedMatch[1]) : null;
    return {
      module,
      line: line ?? null,
      value: value || null,
      valid,
      commitExists,
      implemented: Boolean(implementedMatch),
      reason: !line
        ? "missing status line"
        : !valid
          ? "non-canonical status value"
          : commitExists === false
            ? "implemented commit does not exist"
            : null,
    };
  });
  return summarizeRows(rows, (row) => row.valid && row.commitExists !== false);
}

function scanReverseSignoff(modules) {
  const requiredFields = [
    "Final sign-off status",
    "Reviewer",
    "Date",
    "Prototype reference",
    "Production reference",
    "Mock functional evidence",
    "Mock prototype parity evidence",
    "Real Gateway evidence",
    "Accepted exceptions",
  ];
  const rows = modules.map((module) => {
    const readme = readFileSync(path.join(modulesDir, module, "README.md"), "utf8");
    const section = extractSection(readme, "## Reverse sign-off");
    const missingFields = section
      ? requiredFields.filter((field) => !section.includes(`| ${field} |`))
      : requiredFields;
    const finalStatusMatch = section?.match(/\| Final sign-off status \| `?([^`|\n]+)`? \|/);
    const finalStatus = finalStatusMatch?.[1]?.trim() ?? null;
    const validFinalStatus =
      finalStatus === "accepted" ||
      finalStatus === "accepted-with-exceptions" ||
      finalStatus === "needs-revision" ||
      finalStatus === "blocked";
    return {
      module,
      present: Boolean(section),
      finalStatus,
      missingFields,
      valid: Boolean(section) && missingFields.length === 0 && validFinalStatus,
      reason: !section
        ? "missing Reverse sign-off section"
        : missingFields.length > 0
          ? `missing fields: ${missingFields.join(", ")}`
          : !validFinalStatus
            ? "invalid final sign-off status"
            : null,
    };
  });
  return summarizeRows(rows, (row) => row.valid);
}

function scanPanelTokens(panels, classifications) {
  const tokenExceptions = new Map(
    (classifications.tokenExceptions ?? []).map((entry) => [
      entry.module,
      new Set(entry.tokens ?? []),
    ]),
  );
  const rows = panels.map((module) => {
    const tokens = new Set();
    for (const filePath of walk(path.join(panelsDir, module))) {
      if (!/\.(css|ts|tsx)$/.test(filePath)) {
        continue;
      }
      const text = readFileSync(filePath, "utf8");
      for (const match of text.matchAll(/var\(--[a-zA-Z0-9_-]+\)/g)) {
        const token = match[0].slice("var(".length, -1);
        if (!token.startsWith("--ds-")) {
          tokens.add(token);
        }
      }
    }
    const sorted = Array.from(tokens).toSorted((a, b) => a.localeCompare(b));
    const covered = tokenExceptions.get(module) ?? new Set();
    const uncovered = sorted.filter((token) => !covered.has(token));
    return {
      module,
      tokens: sorted,
      tokenCount: sorted.length,
      uncovered,
      valid: uncovered.length === 0,
    };
  });
  return summarizeRows(rows, (row) => row.valid);
}

function scanA11y(panels, classifications) {
  const panelClassifications = new Map(
    (classifications.panelA11y ?? []).map((entry) => [entry.module, entry]),
  );
  const atomFiles = readdirSync(atomsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
    .map((entry) => path.join(atomsDir, entry.name));
  const atomTests = listFiles(path.join(atomsDir, "__tests__"), (filePath) =>
    /\.test\.tsx?$/.test(filePath),
  );
  const atomAxeTests = atomTests.filter((filePath) =>
    readFileSync(filePath, "utf8").includes("expectNoAxeViolations"),
  );
  const rows = panels.map((module) => {
    const panelDir = path.join(panelsDir, module);
    const hasCoverage = walk(panelDir).some((filePath) => {
      if (!/\.test\.tsx?$/.test(filePath)) {
        return false;
      }
      return /expectNoAxeViolations|vitest-axe|toHaveNoViolations|axe\(/.test(
        readFileSync(filePath, "utf8"),
      );
    });
    const classification = panelClassifications.get(module) ?? null;
    return {
      module,
      hasCoverage,
      classification: classification?.status ?? null,
      valid: hasCoverage || Boolean(classification),
      reason: hasCoverage
        ? null
        : classification
          ? classification.reason
          : "unclassified panel a11y gap",
    };
  });
  return {
    atomFiles: atomFiles.length,
    atomTestFiles: atomTests.length,
    atomAxeTestFiles: atomAxeTests.length,
    panels: summarizeRows(rows, (row) => row.valid),
  };
}

function scanSharedLists(classifications) {
  const terms = [
    "PaginatedList",
    "ListSearchBar",
    "BatchActionBar",
    "InlineEdit",
    "SortableHeader",
    "useListState",
  ];
  const rows = terms.map((term) => {
    let panelUsage = 0;
    for (const filePath of walk(panelsDir)) {
      if (!/\.(ts|tsx)$/.test(filePath)) {
        continue;
      }
      if (readFileSync(filePath, "utf8").includes(term)) {
        panelUsage += 1;
      }
    }
    return { term, panelUsage };
  });
  const classification = classifications.sharedListPrimitives ?? null;
  const validClassifications = new Set(["adopt-now", "remove-now", "keep-experimental-follow-up"]);
  return {
    rows,
    totalPanelUsage: rows.reduce((sum, row) => sum + row.panelUsage, 0),
    classification: classification?.classification ?? null,
    valid:
      rows.some((row) => row.panelUsage > 0) ||
      validClassifications.has(classification?.classification),
    reason: classification?.reason ?? null,
  };
}

function scanEvidenceManifest(modules, manifest) {
  if (!manifest) {
    return {
      present: false,
      moduleCount: 0,
      missingModules: modules,
      unreviewedPrototypeParity: [],
      valid: false,
    };
  }
  const manifestModules = new Map((manifest.modules ?? []).map((entry) => [entry.module, entry]));
  const missingModules = modules.filter((module) => !manifestModules.has(module));
  const unreviewedPrototypeParity = [];
  for (const entry of manifest.modules ?? []) {
    const parity = (entry.evidence ?? []).find((item) => item.level === "mock-prototype-parity");
    if (parity?.verdict === "unreviewed") {
      unreviewedPrototypeParity.push(entry.module);
    }
  }
  return {
    present: true,
    moduleCount: manifest.modules?.length ?? 0,
    missingModules,
    unreviewedPrototypeParity,
    valid: missingModules.length === 0,
  };
}

function runTokenMirrorCheck() {
  const result = spawnSync("bash", ["scripts/check-tokens-drift.sh"], {
    cwd: deckRoot,
    encoding: "utf8",
  });
  return {
    command: "bash scripts/check-tokens-drift.sh",
    exitCode: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    valid: result.status === 0,
  };
}

function collectBlockers(report) {
  const blockers = [];
  if (report.modules.count !== 26 || report.panels.count !== 26) {
    blockers.push(
      `module/panel count mismatch: modules=${report.modules.count}, panels=${report.panels.count}`,
    );
  }
  if (report.readmeStatus.failCount > 0) {
    blockers.push(`README status failures: ${report.readmeStatus.failCount}`);
  }
  if (report.reverseSignoff.failCount > 0) {
    blockers.push(`reverse sign-off failures: ${report.reverseSignoff.failCount}`);
  }
  if (!report.tokenMirror.valid) {
    blockers.push("token mirror drift check failed");
  }
  if (report.panelTokens.failCount > 0) {
    blockers.push(`unclassified panel token drift: ${report.panelTokens.failCount} modules`);
  }
  if (report.a11y.panels.failCount > 0) {
    blockers.push(`unclassified panel a11y gaps: ${report.a11y.panels.failCount} modules`);
  }
  if (!report.sharedLists.valid) {
    blockers.push("shared list primitives have no panel usage and no classification");
  }
  if (!report.evidenceManifest.valid) {
    blockers.push("module evidence manifest missing or incomplete");
  }
  report.blockers = blockers;
}

function printReport(report) {
  console.log("# deck-go frontend verification inventory");
  console.log("");
  console.log(`modules: ${report.modules.count}`);
  console.log(`panels: ${report.panels.count}`);
  console.log(`README status: ${report.readmeStatus.passCount}/${report.readmeStatus.total} pass`);
  console.log(
    `reverse sign-off: ${report.reverseSignoff.passCount}/${report.reverseSignoff.total} pass`,
  );
  console.log(
    `token mirror: ${report.tokenMirror.valid ? "pass" : "fail"} (${report.tokenMirror.command})`,
  );
  console.log(`panel token drift: ${report.panelTokens.failCount} unclassified modules`);
  console.log(
    `atom a11y: ${report.a11y.atomAxeTestFiles}/${report.a11y.atomFiles} atom tests import axe helper`,
  );
  console.log(`panel a11y: ${report.a11y.panels.passCount}/${report.a11y.panels.total} classified`);
  console.log(
    `shared lists: usage=${report.sharedLists.totalPanelUsage}, classification=${report.sharedLists.classification ?? "none"}`,
  );
  console.log(
    `evidence manifest: ${report.evidenceManifest.moduleCount}/${report.modules.count} modules, unreviewed parity=${report.evidenceManifest.unreviewedPrototypeParity.length}`,
  );
  if (report.blockers.length > 0) {
    console.log("");
    console.log("Blockers:");
    for (const blocker of report.blockers) {
      console.log(`- ${blocker}`);
    }
  } else {
    console.log("");
    console.log("No blockers.");
  }
}

function summarizeRows(rows, isValid) {
  const pass = rows.filter(isValid);
  const fail = rows.filter((row) => !isValid(row));
  return {
    total: rows.length,
    passCount: pass.length,
    failCount: fail.length,
    rows,
    failures: fail,
  };
}

function parseStatusValue(line) {
  if (!line) {
    return "";
  }
  return line
    .replace(/^\*\*Status:?\*\*:?\s*/, "")
    .replace(/^`|`$/g, "")
    .trim();
}

function extractSection(text, heading) {
  const start = text.indexOf(heading);
  if (start === -1) {
    return null;
  }
  const rest = text.slice(start);
  const next = rest.slice(heading.length).search(/\n## /);
  return next === -1 ? rest : rest.slice(0, heading.length + next);
}

function gitCommitExists(sha) {
  const result = spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  return result.status === 0;
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function emptyClassifications() {
  return {
    tokenExceptions: [],
    panelA11y: [],
    sharedListPrimitives: null,
  };
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function listDirs(dirPath) {
  return readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted((a, b) => a.localeCompare(b));
}

function listFiles(dirPath, predicate) {
  return walk(dirPath).filter(predicate);
}

function walk(root) {
  if (!existsSync(root)) {
    return [];
  }
  const stat = statSync(root);
  if (!stat.isDirectory()) {
    return [root];
  }
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(child));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

main();
