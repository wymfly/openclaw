import fs from "node:fs/promises";
import path from "node:path";

const contractsRoot = new URL("../", import.meta.url);
const deckGoRoot = path.resolve(contractsRoot.pathname, "..");
const repoRoot = path.resolve(deckGoRoot, "..");
const sourcePath = path.join(deckGoRoot, "contracts/source/deck-list-queries.contract.json");
const endpointContractPath = path.join(deckGoRoot, "contracts/source/deck-endpoints.contract.json");
const apiContractPath = path.join(deckGoRoot, "contracts/source/deck-api.contract.ts");
const generatedTsPath = path.join(
  deckGoRoot,
  "contracts/generated/ts/deck-list-queries.generated.ts",
);
const docPath = path.join(deckGoRoot, "docs/deck-list-query-contract.md");

const allowedModes = new Set(["bounded", "cursor", "offset", "filter-only"]);
const allowedKinds = new Set([
  "limit",
  "cursor",
  "offset",
  "search",
  "sort",
  "filter",
  "date-range",
  "include",
  "transport",
]);
const allowedTypes = new Set(["string", "number", "boolean", "string-array"]);

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

export function validateListQueryContract(contract, context) {
  const issues = [];
  const endpointKeys = context.endpointKeys ?? new Set();
  const deckApiTypes = context.deckApiTypes ?? new Set();

  if (contract.schemaVersion !== 1) {
    issues.push(issue("schemaVersion", "must be 1"));
  }
  if (contract.metadataSourceFormat !== "deck-list-queries-json") {
    issues.push(issue("metadataSourceFormat", "must be deck-list-queries-json"));
  }

  const ids = new Set();
  for (const [index, query] of (contract.queries ?? []).entries()) {
    const base = `queries[${index}]`;
    if (!query.id) {
      issues.push(issue(`${base}.id`, "missing query id"));
    } else if (ids.has(query.id)) {
      issues.push(issue(`${base}.id`, `duplicate query id: ${query.id}`));
    } else {
      ids.add(query.id);
    }
    if (!endpointKeys.has(normalizeEndpointKey(query.endpoint))) {
      issues.push(issue(`${base}.endpoint`, `unknown endpoint: ${query.endpoint ?? "<missing>"}`));
    }
    if (!allowedModes.has(query.paginationMode)) {
      issues.push(
        issue(`${base}.paginationMode`, `unknown mode: ${query.paginationMode ?? "<missing>"}`),
      );
    }
    if (query.responseDto && !deckApiTypes.has(query.responseDto)) {
      issues.push(issue(`${base}.responseDto`, `unknown DTO: ${query.responseDto}`));
    }
    if (query.paginationMode === "cursor" && !query.cursorField) {
      issues.push(issue(`${base}.cursorField`, "cursor pagination requires cursorField"));
    }
    if (
      (query.defaultLimit !== null &&
        query.defaultLimit !== undefined &&
        !Number.isInteger(query.defaultLimit)) ||
      (query.maxLimit !== null && query.maxLimit !== undefined && !Number.isInteger(query.maxLimit))
    ) {
      issues.push(issue(`${base}.limit`, "defaultLimit and maxLimit must be integers or null"));
    }

    const params = new Set();
    for (const [paramIndex, param] of (query.parameters ?? []).entries()) {
      const paramBase = `${base}.parameters[${paramIndex}]`;
      if (!param.id || !param.param) {
        issues.push(issue(paramBase, "missing id or param"));
      }
      if (params.has(param.id)) {
        issues.push(issue(`${paramBase}.id`, `duplicate parameter id: ${param.id}`));
      }
      params.add(param.id);
      if (!allowedKinds.has(param.kind)) {
        issues.push(
          issue(`${paramBase}.kind`, `unknown parameter kind: ${param.kind ?? "<missing>"}`),
        );
      }
      if (!allowedTypes.has(param.type)) {
        issues.push(
          issue(`${paramBase}.type`, `unknown parameter type: ${param.type ?? "<missing>"}`),
        );
      }
      if (param.type === "string-array" && param.format !== "csv") {
        issues.push(issue(`${paramBase}.format`, "string-array parameters must use csv format"));
      }
    }
  }

  return issues;
}

function escapeCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

export function renderMarkdown(contract) {
  const lines = [
    "# Deck Go List Query Contract",
    "",
    "Generated by `make list-query-contract-sync`.",
    "",
    "This document describes current Deck Go product-facing list query semantics. Code and contract source remain the truth; regenerate after source changes.",
    "",
    "| ID | Endpoint | Mode | Response | Collection | Cursor | Default/Max Limit | Parameters |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const query of contract.queries ?? []) {
    const params = (query.parameters ?? [])
      .map(
        (param) =>
          `${param.id}:${param.param}:${param.kind}:${param.type}${param.required ? ":required" : ""}`,
      )
      .join(", ");
    lines.push(
      `| \`${escapeCell(query.id)}\` | \`${escapeCell(query.endpoint)}\` | \`${escapeCell(query.paginationMode)}\` | \`${escapeCell(query.responseDto)}\` | \`${escapeCell(query.collectionField)}\` | ${query.cursorField ? `\`${escapeCell(query.cursorField)}\`` : "none"} | ${query.defaultLimit ?? "none"} / ${query.maxLimit ?? "none"} | ${escapeCell(params)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function renderTypescript(contract) {
  return [
    "// AUTO-GENERATED FROM contracts/source/deck-list-queries.contract.json",
    "// Do not edit this file directly.",
    "",
    `export const deckGoListQueryContract = ${JSON.stringify(contract, null, 2)} as const;`,
    "",
    "export type DeckGoListQueryContract = typeof deckGoListQueryContract;",
    'export type DeckGoListQueryId = DeckGoListQueryContract["queries"][number]["id"];',
    'export type DeckGoListQueryPaginationMode = DeckGoListQueryContract["paginationModes"][number];',
    'export type DeckGoListQueryParameterKind = DeckGoListQueryContract["parameterKinds"][number];',
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
  const issues = validateListQueryContract(contract, {
    endpointKeys: collectEndpointKeys(endpointContract),
    deckApiTypes: collectDeckApiTypes(apiSource),
  });
  if (issues.length > 0) {
    for (const item of issues) {
      console.error(`list-query-contract: ${item.path}: ${item.message}`);
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
      console.error(`${repoPath(generatedTsPath)} is stale. Run: make list-query-contract-sync`);
      drift = true;
    }
    if (actualMarkdown !== expectedMarkdown) {
      console.error(`${repoPath(docPath)} is stale. Run: make list-query-contract-sync`);
      drift = true;
    }
    if (drift) {
      process.exit(1);
    }
    console.log("list query contract is up to date");
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
