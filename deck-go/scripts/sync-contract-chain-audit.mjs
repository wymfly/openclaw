#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const deckRoot = path.resolve(path.dirname(thisFile), "..");
const repoRoot = path.resolve(deckRoot, "..");
const matrixPath = path.join(deckRoot, "docs/contract-chain-audit.matrix.json");
const markdownPath = path.join(deckRoot, "docs/contract-chain-audit.matrix.md");
const checkMode = process.env.CHECK_MODE === "1";

const requiredTopLevel = [
  "schemaVersion",
  "authority",
  "generatedMarkdown",
  "matrixFields",
  "continuationRules",
  "capabilities",
  "decisionIndex",
  "proposalMatrix",
];

const requiredCapabilityFields = [
  "id",
  "module",
  "capability",
  "productRole",
  "coreWorkflow",
  "classification",
  "gatewaySupportBasis",
  "gatewaySource",
  "deckSource",
  "goAdapter",
  "bffEndpoint",
  "contractSource",
  "generatedArtifacts",
  "frontendFacade",
  "panelSurface",
  "mockEvidence",
  "realEvidence",
  "realEvidenceStatus",
  "status",
  "gap",
  "followUpChange",
];

const classifications = new Set([
  "gateway-backed",
  "deck-derived",
  "deck-local",
  "unsupported-needs-contract",
]);
const evidenceStatuses = new Set([
  "not-run",
  "seed-covered",
  "read-path-checked",
  "fixture-checked",
  "blocked",
]);
const capabilityStatuses = new Set(["verified", "degraded", "indexed", "out-of-queue"]);
const followUpStatuses = new Set(["proposed", "implementing", "archived", "deferred"]);

function main() {
  const matrix = readJson(matrixPath);
  const errors = validateMatrix(matrix);
  if (errors.length > 0) {
    console.error(errors.map((error) => `ERROR: ${error}`).join("\n"));
    process.exit(1);
  }

  const nextMarkdown = renderMarkdown(matrix);
  if (checkMode) {
    const current = existsSync(markdownPath) ? readFileSync(markdownPath, "utf8") : "";
    if (current !== nextMarkdown) {
      console.error(
        `DRIFT: ${relative(markdownPath)} is not synchronized with ${relative(matrixPath)}`,
      );
      process.exit(1);
    }
    console.log(`contract-chain-audit: ok (${matrix.capabilities.length} rows)`);
    return;
  }

  writeFileSync(markdownPath, nextMarkdown);
  console.log(
    `contract-chain-audit: wrote ${relative(markdownPath)} (${matrix.capabilities.length} rows)`,
  );
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `failed to read ${relative(filePath)}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function validateMatrix(matrix) {
  const errors = [];
  for (const field of requiredTopLevel) {
    if (!(field in matrix)) {
      errors.push(`missing top-level field ${field}`);
    }
  }
  if (!Array.isArray(matrix.capabilities)) {
    errors.push("capabilities must be an array");
    return errors;
  }
  if (!Array.isArray(matrix.decisionIndex)) {
    errors.push("decisionIndex must be an array");
  }
  if (!Array.isArray(matrix.proposalMatrix)) {
    errors.push("proposalMatrix must be an array");
  }

  const ids = new Set();
  let previousId = "";
  for (const [index, row] of matrix.capabilities.entries()) {
    const prefix = `capabilities[${index}]`;
    for (const field of requiredCapabilityFields) {
      if (!(field in row)) {
        errors.push(`${prefix} missing field ${field}`);
      }
    }
    if (typeof row.id !== "string" || row.id.trim() === "") {
      errors.push(`${prefix}.id must be a non-empty string`);
    } else {
      if (ids.has(row.id)) {
        errors.push(`duplicate capability id ${row.id}`);
      }
      ids.add(row.id);
      if (previousId && previousId.localeCompare(row.id) > 0) {
        errors.push(`capability ids must be sorted: ${previousId} appears before ${row.id}`);
      }
      previousId = row.id;
    }
    if (!classifications.has(row.classification)) {
      errors.push(
        `${row.id}.classification must be one of ${Array.from(classifications).join(", ")}`,
      );
    }
    if (!evidenceStatuses.has(row.realEvidenceStatus)) {
      errors.push(
        `${row.id}.realEvidenceStatus must be one of ${Array.from(evidenceStatuses).join(", ")}`,
      );
    }
    if (!capabilityStatuses.has(row.status)) {
      errors.push(`${row.id}.status must be one of ${Array.from(capabilityStatuses).join(", ")}`);
    }
    if (!row.followUpChange || !followUpStatuses.has(row.followUpChange.status)) {
      errors.push(
        `${row.id}.followUpChange.status must be one of ${Array.from(followUpStatuses).join(", ")}`,
      );
    }
    for (const field of [
      "gatewaySource",
      "deckSource",
      "goAdapter",
      "contractSource",
      "generatedArtifacts",
      "frontendFacade",
      "panelSurface",
      "mockEvidence",
      "realEvidence",
    ]) {
      validatePathList(errors, row, field);
    }
  }

  if (Array.isArray(matrix.proposalMatrix)) {
    for (const [index, proposal] of matrix.proposalMatrix.entries()) {
      if (!proposal.change || !proposal.status || !followUpStatuses.has(proposal.status)) {
        errors.push(`proposalMatrix[${index}] must include change and valid status`);
      }
    }
  }

  return errors;
}

function validatePathList(errors, row, field) {
  if (!Array.isArray(row[field])) {
    errors.push(`${row.id}.${field} must be an array`);
    return;
  }
  for (const entry of row[field]) {
    if (typeof entry !== "string" || entry.trim() === "") {
      errors.push(`${row.id}.${field} includes a non-string entry`);
      continue;
    }
    if (entry.startsWith("/") || entry.includes("://")) {
      continue;
    }
    const clean = entry.split("#")[0];
    if (clean.startsWith("/api/") || clean.startsWith("/v1/")) {
      continue;
    }
    if (!existsSync(path.join(repoRoot, clean))) {
      errors.push(`${row.id}.${field} references missing path ${entry}`);
    }
  }
}

function renderMarkdown(matrix) {
  const lines = [];
  lines.push("# deck-go Contract Chain Audit Matrix");
  lines.push("");
  lines.push(
    "<!-- Generated by deck-go/scripts/sync-contract-chain-audit.mjs. Do not edit by hand. -->",
  );
  lines.push("");
  lines.push(`Source JSON: \`${relative(matrixPath)}\``);
  lines.push("");
  lines.push(`Authority: ${matrix.authority}`);
  lines.push("");
  lines.push(
    "L1 evidence maps to mock/visual/static contract checks. L2 evidence maps to real Gateway checks. `seed-covered` means the capability is only covered by the shared `cpa` + `main` seed and is not module-specific proof.",
  );
  lines.push("");
  lines.push("## Continuation Rules");
  lines.push("");
  for (const rule of matrix.continuationRules) {
    lines.push(`- ${rule}`);
  }
  lines.push("");
  lines.push("## Capability Matrix");
  lines.push("");
  lines.push(
    "| ID | Module | Capability | Class | Product Role | Core Workflow | L1 | L2 | Real Status | Row Status | Follow-up | Gap |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of matrix.capabilities) {
    lines.push(
      [
        row.id,
        row.module,
        row.capability,
        row.classification,
        row.productRole,
        row.coreWorkflow,
        compactEvidence(row.mockEvidence),
        compactEvidence(row.realEvidence),
        row.realEvidenceStatus,
        row.status,
        formatFollowUp(row.followUpChange),
        row.gap,
      ]
        .map(markdownCell)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }
  lines.push("");
  lines.push("## Source Paths");
  lines.push("");
  for (const row of matrix.capabilities) {
    lines.push(`### ${row.id}`);
    lines.push("");
    lines.push(`- Gateway support basis: ${row.gatewaySupportBasis}`);
    lines.push(`- Gateway source: ${formatList(row.gatewaySource)}`);
    lines.push(`- Deck source: ${formatList(row.deckSource)}`);
    lines.push(`- Go adapter/BFF: ${formatList([...row.goAdapter, ...row.bffEndpoint])}`);
    lines.push(`- Contract source: ${formatList(row.contractSource)}`);
    lines.push(`- Generated artifacts: ${formatList(row.generatedArtifacts)}`);
    lines.push(`- Frontend facade: ${formatList(row.frontendFacade)}`);
    lines.push(`- Panel surface: ${formatList(row.panelSurface)}`);
    lines.push("");
  }
  lines.push("## Decision Index");
  lines.push("");
  lines.push(
    "| ID | Priority | Lane | Owner Area | Affected Modules | Follow-up | Status | Suggested Next Action | Evidence |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const item of matrix.decisionIndex) {
    lines.push(
      [
        item.id,
        item.priority,
        item.lane,
        item.ownerArea,
        (item.affectedModules ?? []).join(", "),
        item.followUpChange,
        item.status,
        item.suggestedNextAction,
        item.evidence,
      ]
        .map(markdownCell)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }
  lines.push("");
  lines.push("## Proposal Matrix");
  lines.push("");
  lines.push("| Change | Priority | Wave | Depends On | Status | Exit Criteria |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const proposal of matrix.proposalMatrix) {
    lines.push(
      [
        proposal.change,
        proposal.priority,
        proposal.wave,
        (proposal.dependsOn ?? []).join(", ") || "None",
        proposal.status,
        proposal.exitCriteria,
      ]
        .map(markdownCell)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function compactEvidence(values) {
  return values.length === 0 ? "none" : values.map((entry) => `\`${entry}\``).join("<br>");
}

function formatFollowUp(value) {
  if (!value?.id) {
    return value?.status ?? "deferred";
  }
  return `${value.id} (${value.status})`;
}

function formatList(values) {
  if (!values?.length) {
    return "none";
  }
  return values.map((value) => `\`${value}\``).join(", ");
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\n/g, "<br>")
    .replace(/\|/g, "\\|");
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

main();
