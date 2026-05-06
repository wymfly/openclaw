import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const contractsRoot = new URL("../", import.meta.url);
const deckGoRoot = path.resolve(contractsRoot.pathname, "..");
const repoRoot = path.resolve(deckGoRoot, "..");
const sourcePath = path.join(deckGoRoot, "contracts/source/deck-mutations.contract.json");
const endpointContractPath = path.join(deckGoRoot, "contracts/source/deck-endpoints.contract.json");
const apiContractPath = path.join(deckGoRoot, "contracts/source/deck-api.contract.ts");
const generatedTsPath = path.join(deckGoRoot, "contracts/generated/ts/deck-mutations.generated.ts");
const docPath = path.join(deckGoRoot, "docs/deck-mutation-evidence-contract.md");

const allowedSourceClassifications = new Set(["gateway-backed", "deck-derived", "deck-local"]);
const allowedAuditCoverageModes = new Set(["process-memory", "unsupported", "deferred"]);
const allowedFixtureSafetyStatuses = new Set(["fixture-safe", "skipped-safe", "deferred"]);
const allowedIdempotencyModes = new Set([
  "unsupported",
  "client-generated",
  "gateway-backed",
  "deferred",
]);
const allowedConflictBehaviors = new Set([
  "validation-only",
  "config-write-safety",
  "upstream-preserved",
  "unsupported",
  "deferred",
]);

function repoPath(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

export function normalizeEndpointKey(endpoint) {
  const [rawMethod, ...pathParts] = String(endpoint ?? "")
    .trim()
    .split(/\s+/);
  const method = rawMethod?.toUpperCase();
  const rawPath = pathParts.join(" ");
  if (!method || !rawPath) {
    return "";
  }
  const withoutQuery = rawPath.split("?")[0];
  const normalizedPath = withoutQuery.startsWith("/api/")
    ? withoutQuery
    : `/api${withoutQuery.startsWith("/") ? "" : "/"}${withoutQuery}`;
  return `${method} ${normalizedPath}`;
}

export function collectEndpointKeys(endpointContract) {
  const keys = new Set();
  for (const endpoint of endpointContract.endpoints ?? []) {
    for (const entry of endpoint.paths ?? []) {
      const key = normalizeEndpointKey(entry);
      if (key) {
        keys.add(key);
      }
    }
  }
  return keys;
}

export function collectDeckApiTypes(source) {
  return new Set(
    [...source.matchAll(/export\s+(?:interface|type)\s+(DeckGo[A-Za-z0-9_]+)/g)].map(
      (match) => match[1],
    ),
  );
}

function issue(path, message) {
  return { path, message };
}

function hasPath(value, fieldPath) {
  if (fieldPath === "") {
    return true;
  }
  let cursor = value;
  for (const part of String(fieldPath).split(".")) {
    if (cursor === null || typeof cursor !== "object" || !(part in cursor)) {
      return false;
    }
    cursor = cursor[part];
  }
  return cursor !== null && cursor !== undefined && cursor !== "";
}

export function validateMutationEvidenceContract(contract, context) {
  const issues = [];
  const endpointKeys = context.endpointKeys ?? new Set();
  const deckApiTypes = context.deckApiTypes ?? new Set();
  const fileExists = context.fileExists ?? (() => true);

  if (contract.schemaVersion !== 1) {
    issues.push(issue("schemaVersion", "must be 1"));
  }
  if (contract.metadataSourceFormat !== "deck-mutations-json") {
    issues.push(issue("metadataSourceFormat", "must be deck-mutations-json"));
  }

  const ids = new Set();
  for (const [index, action] of (contract.actions ?? []).entries()) {
    const base = `actions[${index}]`;
    if (!action.id) {
      issues.push(issue(`${base}.id`, "missing action id"));
    } else if (ids.has(action.id)) {
      issues.push(issue(`${base}.id`, `duplicate action id: ${action.id}`));
    } else {
      ids.add(action.id);
    }
    if (!action.ownerModule) {
      issues.push(issue(`${base}.ownerModule`, "missing ownerModule"));
    }
    if (!endpointKeys.has(normalizeEndpointKey(action.route))) {
      issues.push(issue(`${base}.route`, `unknown route: ${action.route ?? "<missing>"}`));
    }
    if (!allowedSourceClassifications.has(action.sourceClassification)) {
      issues.push(
        issue(
          `${base}.sourceClassification`,
          `unknown source classification: ${action.sourceClassification ?? "<missing>"}`,
        ),
      );
    }
    if (
      action.responseDto !== null &&
      action.responseDto !== undefined &&
      !deckApiTypes.has(action.responseDto)
    ) {
      issues.push(issue(`${base}.responseDto`, `unknown DTO: ${action.responseDto}`));
    }
    if (!action.successIndicator?.path) {
      issues.push(issue(`${base}.successIndicator`, "missing success indicator path"));
    }
    if (!["present", true, false].includes(action.successIndicator?.expected)) {
      issues.push(
        issue(`${base}.successIndicator.expected`, "expected must be present, true, or false"),
      );
    }
    if (!["response", "route"].includes(action.targetId?.source) || !action.targetId?.path) {
      issues.push(issue(`${base}.targetId`, "targetId requires source response|route and path"));
    }
    if (!allowedAuditCoverageModes.has(action.auditCoverage?.mode)) {
      issues.push(
        issue(
          `${base}.auditCoverage.mode`,
          `unknown audit coverage: ${action.auditCoverage?.mode ?? "<missing>"}`,
        ),
      );
    }
    if (!allowedIdempotencyModes.has(action.idempotency)) {
      issues.push(
        issue(
          `${base}.idempotency`,
          `unknown idempotency mode: ${action.idempotency ?? "<missing>"}`,
        ),
      );
    }
    if (!allowedConflictBehaviors.has(action.conflictBehavior)) {
      issues.push(
        issue(
          `${base}.conflictBehavior`,
          `unknown conflict behavior: ${action.conflictBehavior ?? "<missing>"}`,
        ),
      );
    }
    if (!allowedFixtureSafetyStatuses.has(action.fixtureSafety?.status)) {
      issues.push(
        issue(
          `${base}.fixtureSafety.status`,
          `unknown fixture safety: ${action.fixtureSafety?.status ?? "<missing>"}`,
        ),
      );
    }
    for (const evidencePath of action.fixtureSafety?.evidence ?? []) {
      if (!fileExists(path.join(repoRoot, evidencePath))) {
        issues.push(
          issue(`${base}.fixtureSafety.evidence`, `missing evidence path: ${evidencePath}`),
        );
      }
    }
  }

  const deferredIds = new Set();
  for (const [index, item] of (contract.deferredClasses ?? []).entries()) {
    const base = `deferredClasses[${index}]`;
    if (!item.id) {
      issues.push(issue(`${base}.id`, "missing deferred class id"));
    } else if (deferredIds.has(item.id)) {
      issues.push(issue(`${base}.id`, `duplicate deferred class id: ${item.id}`));
    } else {
      deferredIds.add(item.id);
    }
    if (!allowedFixtureSafetyStatuses.has(item.fixtureSafety)) {
      issues.push(
        issue(
          `${base}.fixtureSafety`,
          `unknown fixture safety: ${item.fixtureSafety ?? "<missing>"}`,
        ),
      );
    }
    if (!item.reason) {
      issues.push(issue(`${base}.reason`, "missing reason"));
    }
  }

  return issues;
}

function escapeCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function renderSuccess(action) {
  const expected = action.successIndicator?.expected;
  return `${action.successIndicator?.path ?? "n/a"}=${expected === "present" ? "present" : String(expected)}`;
}

export function renderMarkdown(contract) {
  const lines = [
    "# Deck Go Mutation Evidence Contract",
    "",
    "Generated by `make mutation-evidence-contract-sync`.",
    "",
    "This document describes current Deck Go product-facing mutation evidence. Code and contract source remain the truth; regenerate after source changes.",
    "",
    "## Actions",
    "",
    "| ID | Route | Owner | Source | Response | Success | Target | Audit | Idempotency | Conflict | Fixture Safety |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const action of contract.actions ?? []) {
    lines.push(
      `| \`${escapeCell(action.id)}\` | \`${escapeCell(action.route)}\` | ${escapeCell(action.ownerModule)} | ${escapeCell(action.sourceClassification)} | ${escapeCell(action.responseDto ?? "dynamic")} | ${escapeCell(renderSuccess(action))} | ${escapeCell(`${action.targetId?.source}:${action.targetId?.path}`)} | ${escapeCell(action.auditCoverage?.mode)} | ${escapeCell(action.idempotency)} | ${escapeCell(action.conflictBehavior)} | ${escapeCell(action.fixtureSafety?.status)} |`,
    );
  }
  lines.push("", "## Deferred Classes", "");
  lines.push("| ID | Owner | Fixture Safety | Reason |", "| --- | --- | --- | --- |");
  for (const item of contract.deferredClasses ?? []) {
    lines.push(
      `| \`${escapeCell(item.id)}\` | ${escapeCell(item.ownerModule)} | ${escapeCell(item.fixtureSafety)} | ${escapeCell(item.reason)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function renderTypescript(contract) {
  return [
    "// AUTO-GENERATED FROM contracts/source/deck-mutations.contract.json",
    "// Do not edit this file directly.",
    "",
    `export const deckGoMutationEvidenceContract = ${JSON.stringify(contract, null, 2)} as const;`,
    "",
    "export type DeckGoMutationEvidenceContract = typeof deckGoMutationEvidenceContract;",
    'export type DeckGoMutationAction = DeckGoMutationEvidenceContract["actions"][number];',
    'export type DeckGoMutationActionId = DeckGoMutationAction["id"];',
    'export type DeckGoMutationFixtureSafetyStatus = DeckGoMutationEvidenceContract["fixtureSafetyStatuses"][number];',
    'export type DeckGoMutationConflictBehavior = DeckGoMutationEvidenceContract["conflictBehaviors"][number];',
    "",
  ].join("\n");
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function main() {
  const [contract, endpointContract, apiSource] = await Promise.all([
    readJson(sourcePath),
    readJson(endpointContractPath),
    fs.readFile(apiContractPath, "utf8"),
  ]);
  const issues = validateMutationEvidenceContract(contract, {
    endpointKeys: collectEndpointKeys(endpointContract),
    deckApiTypes: collectDeckApiTypes(apiSource),
    fileExists: (file) => fsSync.existsSync(file),
  });
  if (issues.length > 0) {
    for (const item of issues) {
      console.error(`mutation-evidence-contract: ${item.path}: ${item.message}`);
    }
    process.exit(1);
  }

  const expectedTs = renderTypescript(contract);
  const expectedMarkdown = renderMarkdown(contract);
  if (process.env.CHECK_MODE === "1") {
    const [actualTs, actualMarkdown] = await Promise.all([
      fs.readFile(generatedTsPath, "utf8"),
      fs.readFile(docPath, "utf8"),
    ]);
    let drift = false;
    if (actualTs !== expectedTs) {
      console.error(
        `${repoPath(generatedTsPath)} is stale. Run: make mutation-evidence-contract-sync`,
      );
      drift = true;
    }
    if (actualMarkdown !== expectedMarkdown) {
      console.error(`${repoPath(docPath)} is stale. Run: make mutation-evidence-contract-sync`);
      drift = true;
    }
    if (drift) {
      process.exit(1);
    }
    console.log("mutation evidence contract is up to date");
    return;
  }

  await fs.mkdir(path.dirname(generatedTsPath), { recursive: true });
  await Promise.all([
    fs.writeFile(generatedTsPath, expectedTs, "utf8"),
    fs.writeFile(docPath, expectedMarkdown, "utf8"),
  ]);
  console.log(`wrote ${repoPath(generatedTsPath)}`);
  console.log(`wrote ${repoPath(docPath)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

export { hasPath };
