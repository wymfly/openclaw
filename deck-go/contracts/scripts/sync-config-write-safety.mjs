import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const contractsRoot = new URL("../", import.meta.url);
const deckGoRoot = path.resolve(contractsRoot.pathname, "..");
const repoRoot = path.resolve(deckGoRoot, "..");
const sourcePath = path.join(deckGoRoot, "contracts/source/deck-config-write-safety.contract.json");
const routeGovernancePath = path.join(deckGoRoot, "docs/route-governance.json");
const jsonOutPath = path.join(deckGoRoot, "docs/config-write-safety.json");
const markdownOutPath = path.join(deckGoRoot, "docs/config-write-safety.md");
const checkMode = process.env.CHECK_MODE === "1";

const classifications = new Set(["gateway-backed", "deck-derived", "deck-local", "deferred"]);
const baseHashModes = new Set([
  "client-required",
  "client-optional",
  "backend-derived",
  "not-applicable",
]);
const responseHashModes = new Set([
  "compatibility-hash",
  "config-hash",
  "local-version",
  "next-hash",
  "no-hash",
]);
const conflictBehaviors = new Set([
  "backend-classified",
  "frontend-preserves-local",
  "frontend-refreshes-after-failure",
  "not-applicable",
  "upstream-error-preserved",
]);
const supportStatuses = new Set(["supported", "unsupported", "deferred"]);
const requiredFields = [
  "id",
  "owner",
  "route",
  "action",
  "classification",
  "gatewayMethods",
  "baseHashMode",
  "responseHashMode",
  "conflictBehavior",
  "idempotencyStatus",
  "rollbackStatus",
  "auditStatus",
  "contractRefs",
  "backendRefs",
  "frontendRefs",
  "mockEvidence",
  "realEvidence",
];

function repoPath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function loadRouteKeys() {
  if (!existsSync(routeGovernancePath)) {
    return new Set();
  }
  return new Set(readJson(routeGovernancePath).routes.map((route) => route.key));
}

function routeParts(route) {
  const match = /^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/u.exec(route);
  if (!match) {
    return null;
  }
  return { method: match[1], path: match[2] };
}

function validatePathList(errors, write, field) {
  if (!Array.isArray(write[field])) {
    errors.push(`${write.id ?? "<missing-id>"}.${field} must be an array`);
    return;
  }
  for (const entry of write[field]) {
    if (typeof entry !== "string" || entry.trim() === "") {
      errors.push(`${write.id}.${field} includes a non-string entry`);
      continue;
    }
    if (
      entry.startsWith("deferred:") ||
      entry.startsWith("none:") ||
      entry.startsWith("/api/") ||
      entry.startsWith("/v1/")
    ) {
      continue;
    }
    const clean = entry.split("#")[0];
    if (!existsSync(path.join(repoRoot, clean))) {
      errors.push(`${write.id}.${field} references missing path ${entry}`);
    }
  }
}

function validateSource(source, routeKeys) {
  const errors = [];
  if (source.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (!Array.isArray(source.writes)) {
    errors.push("writes must be an array");
    return errors;
  }

  const ids = new Set();
  let previousId = "";
  for (const [index, write] of source.writes.entries()) {
    const label = write.id ?? `writes[${index}]`;
    for (const field of requiredFields) {
      if (!(field in write)) {
        errors.push(`${label} missing ${field}`);
      }
    }
    if (typeof write.id !== "string" || write.id.trim() === "") {
      errors.push(`writes[${index}].id must be a non-empty string`);
      continue;
    }
    if (ids.has(write.id)) {
      errors.push(`duplicate write id ${write.id}`);
    }
    ids.add(write.id);
    if (previousId && previousId.localeCompare(write.id) > 0) {
      errors.push(`write ids must be sorted: ${previousId} appears before ${write.id}`);
    }
    previousId = write.id;

    const parts = routeParts(write.route);
    if (!parts) {
      errors.push(`${write.id}.route must be "<METHOD> <PATH>"`);
    } else if (routeKeys.size > 0 && !routeKeys.has(write.route)) {
      errors.push(`${write.id}.route is not present in route governance: ${write.route}`);
    }
    if (!classifications.has(write.classification)) {
      errors.push(`${write.id}.classification is invalid`);
    }
    if (!baseHashModes.has(write.baseHashMode)) {
      errors.push(`${write.id}.baseHashMode is invalid`);
    }
    if (!responseHashModes.has(write.responseHashMode)) {
      errors.push(`${write.id}.responseHashMode is invalid`);
    }
    if (!conflictBehaviors.has(write.conflictBehavior)) {
      errors.push(`${write.id}.conflictBehavior is invalid`);
    }
    for (const field of ["idempotencyStatus", "rollbackStatus", "auditStatus"]) {
      if (!supportStatuses.has(write[field])) {
        errors.push(`${write.id}.${field} is invalid`);
      }
    }
    if (!Array.isArray(write.gatewayMethods)) {
      errors.push(`${write.id}.gatewayMethods must be an array`);
    } else if (write.classification === "gateway-backed" && write.gatewayMethods.length === 0) {
      errors.push(`${write.id}.gatewayMethods must not be empty for gateway-backed writes`);
    }
    for (const field of [
      "contractRefs",
      "backendRefs",
      "frontendRefs",
      "mockEvidence",
      "realEvidence",
    ]) {
      validatePathList(errors, write, field);
    }
  }
  return errors;
}

function buildReport(source, routeKeys, errors) {
  const writes = source.writes.map((write) => ({
    ...write,
    routeGoverned: routeKeys.has(write.route),
  }));
  const totals = {
    writes: writes.length,
    gatewayBacked: writes.filter((write) => write.classification === "gateway-backed").length,
    deckDerived: writes.filter((write) => write.classification === "deck-derived").length,
    deckLocal: writes.filter((write) => write.classification === "deck-local").length,
    baseHashClientRequired: writes.filter((write) => write.baseHashMode === "client-required")
      .length,
    baseHashBackendDerived: writes.filter((write) => write.baseHashMode === "backend-derived")
      .length,
    idempotencySupported: writes.filter((write) => write.idempotencyStatus === "supported").length,
    rollbackSupported: writes.filter((write) => write.rollbackStatus === "supported").length,
    auditSupported: writes.filter((write) => write.auditStatus === "supported").length,
    errors: errors.length,
  };
  return {
    schemaVersion: 1,
    generatedFrom: repoPath(sourcePath),
    routeGovernanceSource: repoPath(routeGovernancePath),
    generatedAt: "deterministic",
    totals,
    errors,
    writes,
  };
}

function formatList(items) {
  if (!items || items.length === 0) {
    return "n/a";
  }
  return items.map((item) => `\`${item}\``).join(", ");
}

function renderMarkdown(report) {
  const lines = [
    "# deck-go Config Write Safety",
    "",
    "<!-- Generated by deck-go/contracts/scripts/sync-config-write-safety.mjs. Do not edit by hand. -->",
    "",
    `Source: \`${report.generatedFrom}\``,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Writes | ${report.totals.writes} |`,
    `| Gateway-backed | ${report.totals.gatewayBacked} |`,
    `| Deck-derived | ${report.totals.deckDerived} |`,
    `| Deck-local | ${report.totals.deckLocal} |`,
    `| BaseHash client-required | ${report.totals.baseHashClientRequired} |`,
    `| BaseHash backend-derived | ${report.totals.baseHashBackendDerived} |`,
    `| Idempotency supported | ${report.totals.idempotencySupported} |`,
    `| Rollback supported | ${report.totals.rollbackSupported} |`,
    `| Audit supported | ${report.totals.auditSupported} |`,
    `| Errors | ${report.totals.errors} |`,
    "",
    "## Writes",
    "",
    "| ID | Owner | Route | Action | Class | BaseHash | Response Hash | Conflict | Idempotency | Rollback | Audit | Gateway |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const write of report.writes) {
    lines.push(
      [
        write.id,
        write.owner,
        write.route,
        write.action,
        write.classification,
        write.baseHashMode,
        write.responseHashMode,
        write.conflictBehavior,
        write.idempotencyStatus,
        write.rollbackStatus,
        write.auditStatus,
        write.gatewayMethods.join(", ") || "n/a",
      ]
        .map((cell) => String(cell).replaceAll("|", "\\|"))
        .map((cell) => `\`${cell}\``)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }
  lines.push("");
  lines.push("## Evidence");
  for (const write of report.writes) {
    lines.push("");
    lines.push(`### ${write.id}`);
    lines.push("");
    lines.push(`- Contract refs: ${formatList(write.contractRefs)}`);
    lines.push(`- Backend refs: ${formatList(write.backendRefs)}`);
    lines.push(`- Frontend refs: ${formatList(write.frontendRefs)}`);
    lines.push(`- Mock evidence: ${formatList(write.mockEvidence)}`);
    lines.push(`- Real evidence: ${formatList(write.realEvidence)}`);
  }
  if (report.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of report.errors) {
      lines.push(`- ${error}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

const source = readJson(sourcePath);
const routeKeys = loadRouteKeys();
const errors = validateSource(source, routeKeys);
const report = buildReport(source, routeKeys, errors);
const nextJson = `${JSON.stringify(report, null, 2)}\n`;
const nextMarkdown = renderMarkdown(report);

if (checkMode) {
  const currentJson = existsSync(jsonOutPath) ? readFileSync(jsonOutPath, "utf8") : "";
  const currentMarkdown = existsSync(markdownOutPath) ? readFileSync(markdownOutPath, "utf8") : "";
  if (currentJson !== nextJson) {
    console.error(
      "config-write-safety.json is stale. Run: node contracts/scripts/sync-config-write-safety.mjs",
    );
    process.exit(1);
  }
  if (currentMarkdown !== nextMarkdown) {
    console.error(
      "config-write-safety.md is stale. Run: node contracts/scripts/sync-config-write-safety.mjs",
    );
    process.exit(1);
  }
  if (errors.length > 0) {
    console.error(errors.map((error) => `ERROR: ${error}`).join("\n"));
    process.exit(1);
  }
  console.log(`config write safety is up to date (${report.totals.writes} writes)`);
  process.exit(0);
}

writeFileSync(jsonOutPath, nextJson);
writeFileSync(markdownOutPath, nextMarkdown);
console.log(`wrote ${repoPath(jsonOutPath)}`);
console.log(`wrote ${repoPath(markdownOutPath)}`);
if (errors.length > 0) {
  console.error(errors.map((error) => `ERROR: ${error}`).join("\n"));
  process.exit(1);
}
