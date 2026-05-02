import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { parseContractSource } from "./deck-api-codegen.mjs";

const contractsRoot = new URL("../", import.meta.url);
const deckGoRoot = path.resolve(contractsRoot.pathname, "..");
const repoRoot = path.resolve(deckGoRoot, "..");
const sourcePath = path.join(deckGoRoot, "contracts/source/deck-ui.contract.json");
const apiContractPath = path.join(deckGoRoot, "contracts/source/deck-api.contract.ts");
const endpointContractPath = path.join(deckGoRoot, "contracts/source/deck-endpoints.contract.json");
const generatedTsPath = path.join(
  deckGoRoot,
  "contracts/generated/ts/deck-ui-metadata.generated.ts",
);
const docPath = path.join(deckGoRoot, "docs/deck-ui-contract-metadata.md");

const allowedFieldKinds = new Set([
  "boolean",
  "currency",
  "duration",
  "identifier",
  "json",
  "list",
  "mode",
  "number",
  "secret",
  "status",
  "text",
  "timestamp",
  "url",
]);
const allowedInputKinds = new Set([
  "checkbox",
  "number",
  "password",
  "select",
  "switch",
  "text",
  "textarea",
  "url",
]);
const allowedMigrationStatuses = new Set(["migrated", "partial", "planned"]);
const allowedSafetyKinds = new Set(["read", "mutating", "destructive"]);

function repoPath(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

function propertyName(name, sourceFile) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText(sourceFile).replace(/^["']|["']$/g, "");
}

function fieldsFromMembers(members, sourceFile) {
  return new Set(
    members.filter(ts.isPropertySignature).map((member) => propertyName(member.name, sourceFile)),
  );
}

export function collectDtoFieldsFromContractSource(source) {
  const { declarations, sourceFile } = parseContractSource(source);
  const dtoFields = new Map();
  for (const declaration of declarations) {
    if (declaration.kind === "interface") {
      dtoFields.set(declaration.name, fieldsFromMembers(declaration.node.members, sourceFile));
      continue;
    }
    if (ts.isTypeLiteralNode(declaration.node.type)) {
      dtoFields.set(declaration.name, fieldsFromMembers(declaration.node.type.members, sourceFile));
      continue;
    }
    dtoFields.set(declaration.name, new Set());
  }
  return dtoFields;
}

function ensureMapOfSets(value) {
  if (value instanceof Map) {
    return value;
  }
  const map = new Map();
  for (const [key, fields] of Object.entries(value ?? {})) {
    map.set(key, new Set(fields));
  }
  return map;
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

export function collectEndpointKeysFromClassification(contract) {
  const keys = new Set();
  for (const endpoint of contract.endpoints ?? []) {
    for (const entry of endpoint.paths ?? []) {
      const key = normalizeEndpointKey(entry);
      if (key) {
        keys.add(key);
      }
    }
  }
  return keys;
}

function actionMap(metadata) {
  return new Map((metadata.actions ?? []).map((action) => [action.id, action]));
}

function issue(path, message) {
  return { path, message };
}

export function validateMetadata(metadata, context) {
  const issues = [];
  const dtoFields = ensureMapOfSets(context.dtoFields);
  const endpointKeys = new Set(context.endpointKeys ?? []);
  const actionsById = actionMap(metadata);

  if (metadata.schemaVersion !== 1) {
    issues.push(issue("schemaVersion", "must be 1"));
  }
  if (metadata.metadataSourceFormat !== "sibling-ui-contract-json") {
    issues.push(issue("metadataSourceFormat", "must be sibling-ui-contract-json"));
  }

  for (const kind of metadata.fieldKinds ?? []) {
    if (!allowedFieldKinds.has(kind)) {
      issues.push(issue(`fieldKinds.${kind}`, "unknown field kind"));
    }
  }

  for (const [index, domain] of (metadata.domains ?? []).entries()) {
    const base = `domains[${index}]`;
    if (!domain.id) {
      issues.push(issue(`${base}.id`, "missing domain id"));
    }
    if (!domain.label) {
      issues.push(issue(`${base}.label`, "missing domain label"));
    }
    if (!allowedMigrationStatuses.has(domain.migrationStatus)) {
      issues.push(issue(`${base}.migrationStatus`, "must be migrated, partial, or planned"));
    }
    for (const dto of domain.dtos ?? []) {
      if (!dtoFields.has(dto)) {
        issues.push(issue(`${base}.dtos.${dto}`, "unknown DTO"));
      }
    }
    for (const endpoint of domain.endpoints ?? []) {
      const key = normalizeEndpointKey(endpoint);
      if (!endpointKeys.has(key)) {
        issues.push(issue(`${base}.endpoints.${endpoint}`, "unknown endpoint"));
      }
    }
    for (const actionId of domain.actions ?? []) {
      if (!actionsById.has(actionId)) {
        issues.push(issue(`${base}.actions.${actionId}`, "unknown action"));
      }
    }
    for (const endpoint of domain.refresh?.endpoints ?? []) {
      const key = normalizeEndpointKey(endpoint);
      if (!endpointKeys.has(key)) {
        issues.push(issue(`${base}.refresh.${endpoint}`, "unknown refresh endpoint"));
      }
    }
  }

  for (const [index, field] of (metadata.fieldMetadata ?? []).entries()) {
    const base = `fieldMetadata[${index}]`;
    const fields = dtoFields.get(field.dto);
    if (!field.dto || !fields) {
      issues.push(issue(`${base}.dto`, `unknown DTO: ${field.dto ?? "<missing>"}`));
      continue;
    }
    if (!field.field || !fields.has(field.field)) {
      issues.push(
        issue(`${base}.field`, `unknown field ${field.dto}.${field.field ?? "<missing>"}`),
      );
    }
    if (!field.label) {
      issues.push(issue(`${base}.label`, "missing label"));
    }
    if (!allowedFieldKinds.has(field.kind)) {
      issues.push(issue(`${base}.kind`, `unknown field kind: ${field.kind ?? "<missing>"}`));
    }
    if (field.input?.kind && !allowedInputKinds.has(field.input.kind)) {
      issues.push(issue(`${base}.input.kind`, `unknown input kind: ${field.input.kind}`));
    }
    if (field.kind === "status" && !field.statusValues) {
      issues.push(issue(`${base}.statusValues`, "status fields must describe known UI states"));
    }
  }

  for (const [index, action] of (metadata.actions ?? []).entries()) {
    const base = `actions[${index}]`;
    if (!action.id) {
      issues.push(issue(`${base}.id`, "missing action id"));
    }
    if (!action.label) {
      issues.push(issue(`${base}.label`, "missing action label"));
    }
    if (!allowedSafetyKinds.has(action.safety)) {
      issues.push(
        issue(`${base}.safety`, `unknown action safety: ${action.safety ?? "<missing>"}`),
      );
    }
    const endpointKey = normalizeEndpointKey(action.endpoint);
    if (!endpointKeys.has(endpointKey)) {
      issues.push(issue(`${base}.endpoint`, `unknown endpoint: ${action.endpoint ?? "<missing>"}`));
    }
    for (const [dtoField, dto] of [
      ["requestDto", action.requestDto],
      ["resultDto", action.resultDto],
    ]) {
      if (dto && !dtoFields.has(dto)) {
        issues.push(issue(`${base}.${dtoField}`, `unknown DTO: ${dto}`));
      }
    }
    for (const endpoint of action.refresh ?? []) {
      const key = normalizeEndpointKey(endpoint);
      if (!endpointKeys.has(key)) {
        issues.push(issue(`${base}.refresh.${endpoint}`, "unknown refresh endpoint"));
      }
    }
    if (action.safety === "destructive" && action.confirmation?.required !== true) {
      issues.push(issue(`${base}.confirmation`, "destructive actions require confirmation"));
    }
  }

  return issues;
}

function renderTypescript(metadata) {
  return [
    "// AUTO-GENERATED FROM contracts/source/deck-ui.contract.json",
    "// Do not edit this file directly.",
    "",
    `export const deckGoUiContractMetadata = ${JSON.stringify(metadata, null, 2)} as const;`,
    "",
    "export type DeckGoUiContractMetadata = typeof deckGoUiContractMetadata;",
    'export type DeckGoUiMetadataDomainId = DeckGoUiContractMetadata["domains"][number]["id"];',
    'export type DeckGoUiMetadataActionId = DeckGoUiContractMetadata["actions"][number]["id"];',
    "",
  ].join("\n");
}

function renderMarkdown(metadata, issues) {
  const domainRows = (metadata.domains ?? []).map(
    (domain) =>
      `| \`${domain.id}\` | ${domain.label} | ${domain.migrationStatus} | ${(domain.dtos ?? []).length} | ${(domain.endpoints ?? []).length} | ${(domain.actions ?? []).length} |`,
  );
  const fieldRows = (metadata.fieldMetadata ?? []).map(
    (field) => `| \`${field.dto}.${field.field}\` | ${field.label} | \`${field.kind}\` |`,
  );
  const actionRows = (metadata.actions ?? []).map(
    (action) =>
      `| \`${action.id}\` | ${action.label} | \`${action.endpoint}\` | \`${action.safety}\` |`,
  );
  return [
    "# Deck Go UI Contract Metadata",
    "",
    "Generated by `make ui-metadata-sync` from `deck-go/contracts/source/deck-ui.contract.json`.",
    "",
    `Source format: \`${metadata.metadataSourceFormat}\``,
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Domains | ${(metadata.domains ?? []).length} |`,
    `| Field metadata entries | ${(metadata.fieldMetadata ?? []).length} |`,
    `| Actions | ${(metadata.actions ?? []).length} |`,
    `| Validation issues | ${issues.length} |`,
    "",
    "## Domains",
    "",
    "| Domain | Label | Status | DTOs | Endpoints | Actions |",
    "| --- | --- | --- | ---: | ---: | ---: |",
    ...domainRows,
    ...(domainRows.length === 0 ? ["| n/a | n/a | n/a | 0 | 0 | 0 |"] : []),
    "",
    "## Field Metadata",
    "",
    "| Field | Label | Kind |",
    "| --- | --- | --- |",
    ...fieldRows,
    ...(fieldRows.length === 0 ? ["| n/a | n/a | n/a |"] : []),
    "",
    "## Actions",
    "",
    "| Action | Label | Endpoint | Safety |",
    "| --- | --- | --- | --- |",
    ...actionRows,
    ...(actionRows.length === 0 ? ["| n/a | n/a | n/a | n/a |"] : []),
    "",
    "## Validation Issues",
    "",
    "| Path | Issue |",
    "| --- | --- |",
    ...issues.map((entry) => `| \`${entry.path}\` | ${entry.message} |`),
    ...(issues.length === 0 ? ["| n/a | n/a |"] : []),
    "",
  ].join("\n");
}

async function loadMetadataContext() {
  const metadata = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  const dtoFields = collectDtoFieldsFromContractSource(readFileSync(apiContractPath, "utf8"));
  const endpointKeys = existsSync(endpointContractPath)
    ? collectEndpointKeysFromClassification(JSON.parse(readFileSync(endpointContractPath, "utf8")))
    : new Set();
  return { dtoFields, endpointKeys, metadata };
}

async function main() {
  const { dtoFields, endpointKeys, metadata } = await loadMetadataContext();
  const issues = validateMetadata(metadata, { dtoFields, endpointKeys });
  if (issues.length > 0) {
    for (const entry of issues) {
      console.error(`${entry.path}: ${entry.message}`);
    }
    process.exit(1);
  }

  const expectedTs = renderTypescript(metadata);
  const expectedDoc = renderMarkdown(metadata, issues);

  if (process.env.CHECK_MODE === "1") {
    const [actualTs, actualDoc] = await Promise.all([
      fs.readFile(generatedTsPath, "utf8"),
      fs.readFile(docPath, "utf8"),
    ]);
    if (actualTs !== expectedTs || actualDoc !== expectedDoc) {
      console.error(
        "UI metadata generated artifacts are stale. Run: node contracts/scripts/sync-ui-contract-metadata.mjs",
      );
      process.exit(1);
    }
    console.log("ui metadata is up to date");
    return;
  }

  await fs.mkdir(path.dirname(generatedTsPath), { recursive: true });
  await fs.mkdir(path.dirname(docPath), { recursive: true });
  await Promise.all([
    fs.writeFile(generatedTsPath, expectedTs, "utf8"),
    fs.writeFile(docPath, expectedDoc, "utf8"),
  ]);
  console.log(`wrote ${repoPath(generatedTsPath)}`);
  console.log(`wrote ${repoPath(docPath)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
