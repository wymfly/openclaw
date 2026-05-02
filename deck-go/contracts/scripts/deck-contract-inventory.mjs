import { existsSync, readFileSync, readdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import {
  collectDtoFieldsFromContractSource,
  normalizeEndpointKey as normalizeUiEndpointKey,
  validateMetadata,
} from "./sync-ui-contract-metadata.mjs";

const contractsRoot = new URL("../", import.meta.url);
const deckGoRoot = path.resolve(contractsRoot.pathname, "..");
const repoRoot = path.resolve(deckGoRoot, "..");
const apiPath = path.join(deckGoRoot, "frontend/src/api.ts");
const apiTypesPath = path.join(deckGoRoot, "frontend/src/api-types.ts");
const frontendRoot = path.join(deckGoRoot, "frontend/src");
const contractPath = path.join(deckGoRoot, "contracts/source/deck-api.contract.ts");
const endpointContractPath = path.join(deckGoRoot, "contracts/source/deck-endpoints.contract.json");
const exceptionContractPath = path.join(
  deckGoRoot,
  "contracts/source/deck-exceptions.contract.json",
);
const uiMetadataPath = path.join(deckGoRoot, "contracts/source/deck-ui.contract.json");
const serverRoot = path.join(deckGoRoot, "backend/internal/server");
const runtimeOpenClawRoot = path.join(deckGoRoot, "backend/internal/runtime/openclaw");
const docsDir = path.join(deckGoRoot, "docs");
const jsonOut = path.join(docsDir, "contract-inventory.json");
const mdOut = path.join(docsDir, "contract-inventory.md");

const domainMatchers = [
  ["runtime", /Runtime|Bootstrap|Gateway/],
  ["settings", /Settings/],
  ["devices", /Device|Paired/],
  ["channels", /Channel/],
  ["plugins", /Plugin/],
  ["agents", /Agent/],
  ["tools", /Tool/],
  ["skills", /Skill/],
  ["sessions-chat", /Session|Chat|Transcript|Compaction/],
  ["approvals", /Approval/],
  ["usage-monitor", /Usage|Monitor|Activity/],
  ["nodes", /Node|Pairing/],
  ["cron", /Cron/],
  ["docs", /Doc/],
  ["alerts-webhooks", /Alert|Webhook/],
  ["memory", /Memory/],
  ["budget", /Budget/],
  ["routing", /Routing/],
  ["identity-threads", /Identity|Thread/],
  ["subagents", /Subagent/],
];
const allowedEndpointCategories = new Set([
  "deck-go-bff",
  "documented-exception",
  "gateway-protocol-adapter",
  "stream-binary-upload",
]);

function repoPath(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

function walk(dir, predicate) {
  if (!existsSync(dir)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(child, predicate));
    } else if (predicate(child)) {
      files.push(child);
    }
  }
  return files.toSorted((a, b) => a.localeCompare(b));
}

function exportedDeckGoTypes(source) {
  const names = new Set(
    [...source.matchAll(/export\s+(?:interface|type)\s+(DeckGo[A-Za-z0-9_]+)/g)].map(
      (match) => match[1],
    ),
  );
  for (const match of source.matchAll(/export\s+type\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .at(-1)
        ?.trim();
      if (name?.startsWith("DeckGo")) {
        names.add(name);
      }
    }
  }
  return [...names];
}

function isExported(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function collectGeneratedImports(sourceFile) {
  const imports = new Set();
  for (const node of sourceFile.statements) {
    if (!ts.isImportDeclaration(node)) {
      continue;
    }
    if (!node.moduleSpecifier.getText(sourceFile).includes("deck-api.generated")) {
      continue;
    }
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) {
      continue;
    }
    for (const element of bindings.elements) {
      imports.add(element.name.text);
    }
  }
  return imports;
}

function collectIdentifiers(node) {
  const names = new Set();
  function visit(child) {
    if (ts.isIdentifier(child)) {
      names.add(child.text);
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return names;
}

function collectApiDtoAuthority(source, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const generatedImports = collectGeneratedImports(sourceFile);
  const declarations = [];
  const aliasRefs = new Map();
  const generatedBackedByName = new Map();

  for (const node of sourceFile.statements) {
    if (ts.isExportDeclaration(node) && node.isTypeOnly && ts.isNamedExports(node.exportClause)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      for (const element of node.exportClause.elements) {
        const name = element.name.text;
        if (name.startsWith("DeckGo")) {
          declarations.push({
            generatedBacked: true,
            kind: "re-export",
            line: line + 1,
            name,
            refs: [],
          });
          generatedBackedByName.set(name, true);
        }
      }
      continue;
    }
    if (!isExported(node)) {
      continue;
    }
    if (!ts.isTypeAliasDeclaration(node) && !ts.isInterfaceDeclaration(node)) {
      continue;
    }
    const name = node.name.text;
    if (!name.startsWith("DeckGo")) {
      continue;
    }
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const refs = ts.isTypeAliasDeclaration(node) ? collectIdentifiers(node.type) : new Set();
    const typeText = ts.isTypeAliasDeclaration(node) ? node.type.getText(sourceFile) : "";
    const directGenerated =
      ts.isTypeAliasDeclaration(node) &&
      ([...refs].some((ref) => generatedImports.has(ref) || ref.startsWith("GeneratedDeckGo")) ||
        typeText.includes("DeckApi."));
    declarations.push({
      generatedBacked: directGenerated,
      kind: ts.isTypeAliasDeclaration(node) ? "type" : "interface",
      line: line + 1,
      name,
      refs: [...refs],
    });
    aliasRefs.set(name, refs);
    generatedBackedByName.set(name, directGenerated);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, refs] of aliasRefs) {
      if (generatedBackedByName.get(name)) {
        continue;
      }
      if ([...refs].some((ref) => generatedBackedByName.get(ref))) {
        generatedBackedByName.set(name, true);
        changed = true;
      }
    }
  }

  return declarations.map((declaration) => ({
    ...declaration,
    generatedBacked: generatedBackedByName.get(declaration.name) === true,
  }));
}

function exportedApiFunctions(source) {
  return [...source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)].map(
    (match) => match[1],
  );
}

function domainForType(name) {
  for (const [domain, pattern] of domainMatchers) {
    if (pattern.test(name)) {
      return domain;
    }
  }
  return "other";
}

function migrationDomainForType(name) {
  const domain = domainForType(name);
  if (domain === "runtime" || domain === "settings") {
    return "runtime-settings";
  }
  if (domain === "agents" || domain === "tools" || domain === "routing" || domain === "subagents") {
    return "agents-tools";
  }
  if (domain === "sessions-chat") {
    return "sessions-chat";
  }
  if (domain === "usage-monitor") {
    return "usage-monitor";
  }
  if (domain === "approvals") {
    return "approvals";
  }
  return domain;
}

function groupCounts(names) {
  const counts = {};
  for (const name of names) {
    const domain = domainForType(name);
    counts[domain] = (counts[domain] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).toSorted(([a], [b]) => a.localeCompare(b)));
}

function normalizeMethod(method) {
  if (method.startsWith("http.Method")) {
    return method.slice("http.Method".length).toUpperCase();
  }
  return method.toUpperCase();
}

function endpointPrefix(file) {
  const base = path.basename(file);
  if (base === "admin_http_guard.go" || base === "callback_proxy.go") {
    return "";
  }
  return "/api";
}

function collectEndpoints() {
  const endpoints = [];
  const files = walk(serverRoot, (file) => file.endsWith(".go") && !file.endsWith("_test.go"));
  const pattern = /MethodFunc\(\s*(?:"([^"]+)"|http\.Method([A-Za-z]+))\s*,\s*"([^"]+)"/g;
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const match of line.matchAll(pattern)) {
        const method = normalizeMethod(match[1] ?? `http.Method${match[2]}`);
        const routePath = match[3];
        endpoints.push({
          file: repoPath(file),
          line: index + 1,
          method,
          path: `${endpointPrefix(file)}${routePath}`,
        });
      }
    });
  }
  return endpoints.toSorted((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
  );
}

function collectDynamicSurfaces() {
  const roots = [serverRoot, runtimeOpenClawRoot];
  const surfaces = [];
  const patterns = [
    { kind: "map-string-any", pattern: /map\[string\]any/ },
    { kind: "write-json-any", pattern: /writeJSON\([^)]*,\s*[^)]*,\s*[^)]*any|writeJSON\(/ },
    { kind: "raw-any-result", pattern: /\bany\b/ },
  ];
  for (const root of roots) {
    for (const file of walk(
      root,
      (candidate) => candidate.endsWith(".go") && !candidate.endsWith("_test.go"),
    )) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const { kind, pattern } of patterns) {
          if (pattern.test(line)) {
            surfaces.push({
              file: repoPath(file),
              kind,
              line: index + 1,
              text: line.trim(),
            });
            break;
          }
        }
      });
    }
  }
  return surfaces;
}

function currentSymbolFromLine(line, fallback) {
  const patterns = [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/,
    /\bfunction\s+([A-Za-z0-9_]+)/,
    /\bexport\s+const\s+([A-Za-z0-9_]+)/,
    /\bconst\s+([A-Za-z0-9_]+)\s*=/,
  ];
  const localNames = new Set([
    "body",
    "controller",
    "data",
    "error",
    "headers",
    "json",
    "payload",
    "request",
    "response",
    "result",
  ]);
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match && !localNames.has(match[1])) {
      return match[1];
    }
  }
  return fallback;
}

function inferHttpMethod(lines, index) {
  const window = lines.slice(index, Math.min(lines.length, index + 8)).join("\n");
  const methodMatch = window.match(/\bmethod:\s*["']([A-Z]+)["']/);
  return methodMatch?.[1] ?? "GET";
}

function normalizeEndpointKey(method, routePath) {
  const withoutQuery = routePath.split("?")[0];
  const normalizedPath = withoutQuery.startsWith("/api/")
    ? withoutQuery
    : `/api${withoutQuery.startsWith("/") ? "" : "/"}${withoutQuery}`;
  return `${method.toUpperCase()} ${normalizedPath}`;
}

function routePattern(pathPattern) {
  const escaped = pathPattern
    .split(/(\{[^}]+\}|\*)/)
    .map((part) => {
      if (part === "*") {
        return ".*";
      }
      if (part.startsWith("{") && part.endsWith("}")) {
        return "[^/]+";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp(`^${escaped}$`);
}

function collectClassifiedEndpoints() {
  if (!existsSync(endpointContractPath)) {
    return {
      endpoints: [],
      issues: [{ key: "source", message: "missing endpoint contract source" }],
    };
  }
  const contract = JSON.parse(readFileSync(endpointContractPath, "utf8"));
  const endpoints = [];
  const issues = [];
  for (const endpoint of contract.endpoints ?? []) {
    if (!allowedEndpointCategories.has(endpoint.category)) {
      issues.push({
        key: endpoint.paths?.join(", ") ?? "unknown",
        message: `unknown category: ${endpoint.category ?? "<missing>"}`,
      });
    }
    for (const entry of endpoint.paths ?? []) {
      const [method, ...pathParts] = entry.split(/\s+/);
      const routePath = pathParts.join(" ");
      if (!method || !routePath) {
        issues.push({ key: entry, message: "invalid endpoint path entry" });
        continue;
      }
      const normalized = normalizeEndpointKey(method, routePath);
      const [, ...normalizedPathParts] = normalized.split(/\s+/);
      const pathTemplate = normalizedPathParts.join(" ");
      endpoints.push({
        category: endpoint.category,
        key: normalized,
        migrationTarget: endpoint.migrationTarget ?? "",
        method: method.toUpperCase(),
        pathPattern: routePattern(pathTemplate),
        pathTemplate,
      });
    }
  }
  return { endpoints, issues };
}

function collectExceptionIssues() {
  if (!existsSync(exceptionContractPath)) {
    return [{ key: "source", message: "missing exception contract source" }];
  }
  const contract = JSON.parse(readFileSync(exceptionContractPath, "utf8"));
  const requiredFields = ["id", "kind", "owner", "reason", "exitCriteria"];
  const issues = [];
  for (const exception of contract.exceptions ?? []) {
    for (const field of requiredFields) {
      if (!exception[field]) {
        issues.push({
          key: exception.id ?? exception.method ?? "unknown",
          message: `missing ${field}`,
        });
      }
    }
    if (!exception.method && !exception.endpoint && !exception.path) {
      issues.push({
        key: exception.id ?? "unknown",
        message: "missing affected method or endpoint",
      });
    }
  }
  return issues;
}

function collectExceptionSummary() {
  if (!existsSync(exceptionContractPath)) {
    return { byKind: {}, total: 0 };
  }
  const contract = JSON.parse(readFileSync(exceptionContractPath, "utf8"));
  const exceptions = contract.exceptions ?? [];
  return {
    byKind: countBy(exceptions, (exception) => exception.kind),
    total: exceptions.length,
  };
}

function collectUiMetadata(contractSource, classifiedEndpoints) {
  if (!existsSync(uiMetadataPath)) {
    return {
      actions: [],
      coveredDtos: [],
      coveredEndpoints: [],
      domains: [],
      fieldMetadata: [],
      issues: [{ path: "source", message: "missing UI metadata source" }],
    };
  }
  const metadata = JSON.parse(readFileSync(uiMetadataPath, "utf8"));
  const endpointKeys = new Set(
    classifiedEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.pathTemplate}`),
  );
  const dtoFields = collectDtoFieldsFromContractSource(contractSource);
  const issues = validateMetadata(metadata, { dtoFields, endpointKeys });
  const coveredDtos = new Set();
  const coveredEndpoints = new Set();
  for (const domain of metadata.domains ?? []) {
    for (const dto of domain.dtos ?? []) {
      coveredDtos.add(dto);
    }
    for (const endpoint of domain.endpoints ?? []) {
      coveredEndpoints.add(normalizeUiEndpointKey(endpoint));
    }
    for (const endpoint of domain.refresh?.endpoints ?? []) {
      coveredEndpoints.add(normalizeUiEndpointKey(endpoint));
    }
  }
  for (const field of metadata.fieldMetadata ?? []) {
    if (field.dto) {
      coveredDtos.add(field.dto);
    }
  }
  for (const action of metadata.actions ?? []) {
    if (action.endpoint) {
      coveredEndpoints.add(normalizeUiEndpointKey(action.endpoint));
    }
    if (action.requestDto) {
      coveredDtos.add(action.requestDto);
    }
    if (action.resultDto) {
      coveredDtos.add(action.resultDto);
    }
    for (const endpoint of action.refresh ?? []) {
      coveredEndpoints.add(normalizeUiEndpointKey(endpoint));
    }
  }
  return {
    actions: metadata.actions ?? [],
    coveredDtos: [...coveredDtos].toSorted((left, right) => left.localeCompare(right)),
    coveredEndpoints: [...coveredEndpoints]
      .filter(Boolean)
      .toSorted((left, right) => left.localeCompare(right)),
    domains: metadata.domains ?? [],
    fieldMetadata: metadata.fieldMetadata ?? [],
    issues,
  };
}

function collectFrontendCallers(classifiedEndpoints) {
  const files = walk(
    frontendRoot,
    (file) =>
      /\.(ts|tsx)$/.test(file) &&
      !file.includes(`${path.sep}__tests__${path.sep}`) &&
      !file.endsWith(".test.ts") &&
      !file.endsWith(".test.tsx"),
  );
  const callers = [];
  const seen = new Set();
  const stringPattern = /["'`]((?:\/api)?\/[A-Za-z0-9_./:{}?=&*:-]+)["'`]/g;
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    let symbol = "module";
    lines.forEach((line, index) => {
      symbol = currentSymbolFromLine(line, symbol);
      for (const match of line.matchAll(stringPattern)) {
        const literal = match[1];
        if (literal.includes("${")) {
          continue;
        }
        const normalizedPath = literal.startsWith("/api/")
          ? literal
          : `/api${literal.startsWith("/") ? "" : "/"}${literal}`;
        const withoutQuery = normalizedPath.split("?")[0];
        const method = inferHttpMethod(lines, index);
        const matches = classifiedEndpoints.filter(
          (endpoint) => endpoint.method === method && endpoint.pathPattern.test(withoutQuery),
        );
        const exactMatches = matches.filter((endpoint) => endpoint.pathTemplate === withoutQuery);
        for (const endpoint of exactMatches.length > 0 ? exactMatches : matches) {
          const key = `${file}:${index + 1}:${literal}:${endpoint.key}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          callers.push({
            endpoint: endpoint.key,
            file: repoPath(file),
            line: index + 1,
            literal,
            symbol,
          });
        }
      }
    });
  }
  return callers.toSorted((a, b) =>
    `${a.endpoint} ${a.file}:${a.line}`.localeCompare(`${b.endpoint} ${b.file}:${b.line}`),
  );
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).toSorted(([a], [b]) => a.localeCompare(b)));
}

const apiSource = readFileSync(apiPath, "utf8");
const apiTypesSource = existsSync(apiTypesPath) ? readFileSync(apiTypesPath, "utf8") : "";
const contractSource = readFileSync(contractPath, "utf8");
const apiTypes = [
  ...new Set([...exportedDeckGoTypes(apiSource), ...exportedDeckGoTypes(apiTypesSource)]),
];
const apiDtoDeclarations = [
  ...collectApiDtoAuthority(apiSource, apiPath),
  ...(apiTypesSource ? collectApiDtoAuthority(apiTypesSource, apiTypesPath) : []),
];
const contractTypes = exportedDeckGoTypes(contractSource);
const apiFunctions = exportedApiFunctions(apiSource);
const contractSet = new Set(contractTypes);
const missingTypes = apiTypes.filter((name) => !contractSet.has(name));
const endpoints = collectEndpoints();
const dynamicSurfaces = collectDynamicSurfaces();
const { endpoints: classifiedEndpoints, issues: endpointClassificationIssues } =
  collectClassifiedEndpoints();
const exceptionIssues = collectExceptionIssues();
const exceptionSummary = collectExceptionSummary();
const unclassifiedEndpoints = endpoints.filter(
  (endpoint) =>
    !classifiedEndpoints.some(
      (classified) =>
        classified.method === endpoint.method && classified.pathPattern.test(endpoint.path),
    ),
);
const endpointCategoryCounts = countBy(classifiedEndpoints, (endpoint) => endpoint.category);
const frontendCallers = collectFrontendCallers(classifiedEndpoints);
const endpointKeysWithFrontendCallers = new Set(frontendCallers.map((caller) => caller.endpoint));
const uiMetadata = collectUiMetadata(contractSource, classifiedEndpoints);
const migratedUiDomains = uiMetadata.domains.filter(
  (domain) => domain.migrationStatus === "migrated",
);
const migratedDomainIds = new Set(migratedUiDomains.map((domain) => domain.id));
const duplicateDtoAuthorityIssues = apiDtoDeclarations
  .filter((declaration) => contractSet.has(declaration.name) && !declaration.generatedBacked)
  .map((declaration) => ({
    file: repoPath(apiPath),
    line: declaration.line,
    message: "frontend-local DTO duplicates generated contract authority",
    name: declaration.name,
  }));
const migratedMissingTypes = missingTypes.filter((name) =>
  migratedDomainIds.has(migrationDomainForType(name)),
);
const migratedDuplicateDtoAuthorityIssues = duplicateDtoAuthorityIssues.filter((entry) =>
  migratedDomainIds.has(migrationDomainForType(entry.name)),
);
const migratedBlockingIssues = [
  ...migratedMissingTypes.map((name) => ({
    key: name,
    message: "migrated domain DTO is still missing from deck-api.contract.ts",
  })),
  ...migratedDuplicateDtoAuthorityIssues.map((entry) => ({
    key: entry.name,
    message: `${entry.file}:${entry.line} still owns a DTO that should be generated-backed`,
  })),
];
const frontendLocalDtoDefinitionNames = new Set(
  apiDtoDeclarations
    .filter((declaration) => !declaration.generatedBacked)
    .map((declaration) => declaration.name),
);
const frontendGeneratedDtoAliasNames = new Set(
  apiDtoDeclarations
    .filter((declaration) => declaration.generatedBacked)
    .map((declaration) => declaration.name),
);

const inventory = {
  generatedAt: new Date().toISOString(),
  summary: {
    apiFunctions: apiFunctions.length,
    classifiedEndpointRows: classifiedEndpoints.length,
    contractTypes: contractTypes.length,
    dynamicSurfaceLines: dynamicSurfaces.length,
    endpoints: endpoints.length,
    exceptionRecordsMissingFields: exceptionIssues.length,
    frontendDeckGoTypes: apiTypes.length,
    frontendEndpointCallerLines: frontendCallers.length,
    frontendGeneratedDtoAliases: frontendGeneratedDtoAliasNames.size,
    frontendLocalDtoDefinitions: frontendLocalDtoDefinitionNames.size,
    gatewayUntypedExceptions: exceptionSummary.byKind["untyped-gateway-method"] ?? 0,
    invalidEndpointClassifications: endpointClassificationIssues.length,
    migratedBlockingIssues: migratedBlockingIssues.length,
    missingContractTypes: missingTypes.length,
    duplicateDtoAuthorityIssues: duplicateDtoAuthorityIssues.length,
    unclassifiedEndpoints: unclassifiedEndpoints.length,
    undocumentedDynamicSurfaceLines: dynamicSurfaces.length,
    endpointsWithFrontendCallers: endpointKeysWithFrontendCallers.size,
    uiMetadataActions: uiMetadata.actions.length,
    uiMetadataCoveredDtos: uiMetadata.coveredDtos.length,
    uiMetadataCoveredEndpoints: uiMetadata.coveredEndpoints.length,
    uiMetadataDomains: uiMetadata.domains.length,
    uiMetadataFieldEntries: uiMetadata.fieldMetadata.length,
    uiMetadataIssues: uiMetadata.issues.length,
    uiMetadataMigratedDomains: migratedUiDomains.length,
  },
  endpointCategoryCounts,
  endpointClassificationIssues,
  exceptionSummary,
  exceptionIssues,
  duplicateDtoAuthorityIssues,
  migratedBlockingIssues,
  uiMetadata: {
    actions: uiMetadata.actions.map((action) => ({
      endpoint: action.endpoint,
      id: action.id,
      safety: action.safety,
    })),
    coveredDtos: uiMetadata.coveredDtos,
    coveredEndpoints: uiMetadata.coveredEndpoints,
    domains: uiMetadata.domains.map((domain) => ({
      actions: domain.actions ?? [],
      dtos: domain.dtos ?? [],
      endpoints: domain.endpoints ?? [],
      id: domain.id,
      migrationStatus: domain.migrationStatus,
    })),
    issues: uiMetadata.issues,
  },
  typeDomains: {
    contract: groupCounts(contractTypes),
    frontend: groupCounts(apiTypes),
    missing: groupCounts(missingTypes),
  },
  missingTypes,
  endpoints,
  frontendCallers,
  unclassifiedEndpoints,
  dynamicSurfaces,
};

const missingTypeLines =
  missingTypes.length === 0 ? [] : ["", ...missingTypes.map((name) => `- \`${name}\``)];

const mdLines = [
  "# Deck Go Contract Inventory",
  "",
  "Generated by `make contract-inventory`.",
  "",
  "## Summary",
  "",
  "| Metric | Count |",
  "| --- | ---: |",
  `| Frontend exported DeckGo types | ${inventory.summary.frontendDeckGoTypes} |`,
  `| Frontend generated DTO aliases | ${inventory.summary.frontendGeneratedDtoAliases} |`,
  `| Frontend local DTO definitions | ${inventory.summary.frontendLocalDtoDefinitions} |`,
  `| Contract source DeckGo types | ${inventory.summary.contractTypes} |`,
  `| Missing contract types | ${inventory.summary.missingContractTypes} |`,
  `| Duplicate DTO authority issues | ${inventory.summary.duplicateDtoAuthorityIssues} |`,
  `| Migrated-domain blocking issues | ${inventory.summary.migratedBlockingIssues} |`,
  `| Frontend API functions | ${inventory.summary.apiFunctions} |`,
  `| Frontend endpoint caller lines | ${inventory.summary.frontendEndpointCallerLines} |`,
  `| Endpoint registrations with frontend callers | ${inventory.summary.endpointsWithFrontendCallers} |`,
  `| Browser-facing endpoint registrations | ${inventory.summary.endpoints} |`,
  `| Classified endpoint rows | ${inventory.summary.classifiedEndpointRows} |`,
  `| Unclassified endpoint registrations | ${inventory.summary.unclassifiedEndpoints} |`,
  `| Invalid endpoint classification rows | ${inventory.summary.invalidEndpointClassifications} |`,
  `| Gateway untyped exceptions | ${inventory.summary.gatewayUntypedExceptions} |`,
  `| Exception records missing fields | ${inventory.summary.exceptionRecordsMissingFields} |`,
  `| UI metadata domains | ${inventory.summary.uiMetadataDomains} |`,
  `| UI metadata migrated domains | ${inventory.summary.uiMetadataMigratedDomains} |`,
  `| UI metadata field entries | ${inventory.summary.uiMetadataFieldEntries} |`,
  `| UI metadata actions | ${inventory.summary.uiMetadataActions} |`,
  `| UI metadata covered DTOs | ${inventory.summary.uiMetadataCoveredDtos} |`,
  `| UI metadata covered endpoints | ${inventory.summary.uiMetadataCoveredEndpoints} |`,
  `| UI metadata issues | ${inventory.summary.uiMetadataIssues} |`,
  `| Potential undocumented dynamic surface lines | ${inventory.summary.undocumentedDynamicSurfaceLines} |`,
  `| Dynamic backend surface lines | ${inventory.summary.dynamicSurfaceLines} |`,
  "",
  "## Endpoint Categories",
  "",
  "| Category | Count |",
  "| --- | ---: |",
  ...Object.entries(inventory.endpointCategoryCounts).map(
    ([category, count]) => `| \`${category}\` | ${count} |`,
  ),
  "",
  "## Missing Types by Domain",
  "",
  "| Domain | Count |",
  "| --- | ---: |",
  ...Object.entries(inventory.typeDomains.missing).map(
    ([domain, count]) => `| ${domain} | ${count} |`,
  ),
  "",
  "## Endpoint Registrations",
  "",
  "| Method | Path | Source |",
  "| --- | --- | --- |",
  ...endpoints.map(
    (endpoint) =>
      `| ${endpoint.method} | \`${endpoint.path}\` | \`${endpoint.file}:${endpoint.line}\` |`,
  ),
  "",
  "## Unclassified Endpoint Registrations",
  "",
  "| Method | Path | Source |",
  "| --- | --- | --- |",
  ...unclassifiedEndpoints.map(
    (endpoint) =>
      `| ${endpoint.method} | \`${endpoint.path}\` | \`${endpoint.file}:${endpoint.line}\` |`,
  ),
  ...(unclassifiedEndpoints.length === 0 ? ["| n/a | n/a | n/a |"] : []),
  "",
  "## Endpoint Classification Issues",
  "",
  "| Key | Issue |",
  "| --- | --- |",
  ...endpointClassificationIssues.map((issue) => `| \`${issue.key}\` | ${issue.message} |`),
  ...(endpointClassificationIssues.length === 0 ? ["| n/a | n/a |"] : []),
  "",
  "## Exception Registry Issues",
  "",
  "| Key | Issue |",
  "| --- | --- |",
  ...exceptionIssues.map((issue) => `| \`${issue.key}\` | ${issue.message} |`),
  ...(exceptionIssues.length === 0 ? ["| n/a | n/a |"] : []),
  "",
  "## Duplicate DTO Authority Issues",
  "",
  "| DTO | Source | Issue |",
  "| --- | --- | --- |",
  ...duplicateDtoAuthorityIssues.map(
    (entry) => `| \`${entry.name}\` | \`${entry.file}:${entry.line}\` | ${entry.message} |`,
  ),
  ...(duplicateDtoAuthorityIssues.length === 0 ? ["| n/a | n/a | n/a |"] : []),
  "",
  "## Migrated-Domain Blocking Issues",
  "",
  "| Key | Issue |",
  "| --- | --- |",
  ...migratedBlockingIssues.map((entry) => `| \`${entry.key}\` | ${entry.message} |`),
  ...(migratedBlockingIssues.length === 0 ? ["| n/a | n/a |"] : []),
  "",
  "## UI Metadata Coverage",
  "",
  "| Domain | Status | DTOs | Endpoints | Actions |",
  "| --- | --- | ---: | ---: | ---: |",
  ...inventory.uiMetadata.domains.map(
    (domain) =>
      `| \`${domain.id}\` | ${domain.migrationStatus} | ${domain.dtos.length} | ${domain.endpoints.length} | ${domain.actions.length} |`,
  ),
  ...(inventory.uiMetadata.domains.length === 0 ? ["| n/a | n/a | 0 | 0 | 0 |"] : []),
  "",
  "## UI Metadata Issues",
  "",
  "| Path | Issue |",
  "| --- | --- |",
  ...inventory.uiMetadata.issues.map((entry) => `| \`${entry.path}\` | ${entry.message} |`),
  ...(inventory.uiMetadata.issues.length === 0 ? ["| n/a | n/a |"] : []),
  "",
  "## Frontend Endpoint Callers",
  "",
  "| Endpoint | Caller | Literal |",
  "| --- | --- | --- |",
  ...frontendCallers.map(
    (caller) =>
      `| \`${caller.endpoint}\` | \`${caller.file}:${caller.line}\` (${caller.symbol}) | \`${caller.literal}\` |`,
  ),
  ...(frontendCallers.length === 0 ? ["| n/a | n/a | n/a |"] : []),
  "",
  "## Potential Undocumented Dynamic Leaves",
  "",
  "This is a reporting-only sample from backend dynamic surfaces; tighten migrated modules before making this global-blocking.",
  "",
  "| Kind | Source | Text |",
  "| --- | --- | --- |",
  ...dynamicSurfaces
    .slice(0, 100)
    .map(
      (entry) =>
        `| \`${entry.kind}\` | \`${entry.file}:${entry.line}\` | \`${entry.text.replaceAll("|", "\\|")}\` |`,
    ),
  ...(dynamicSurfaces.length === 0 ? ["| n/a | n/a | n/a |"] : []),
  "",
  "## Missing Type Names",
  ...missingTypeLines,
];

await fs.mkdir(docsDir, { recursive: true });
await fs.writeFile(jsonOut, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
await fs.writeFile(mdOut, `${mdLines.join("\n")}\n`, "utf8");

console.log(`wrote ${repoPath(jsonOut)}`);
console.log(`wrote ${repoPath(mdOut)}`);

if (migratedBlockingIssues.length > 0) {
  console.error(
    `contract-inventory found ${migratedBlockingIssues.length} migrated-domain blocking issue(s)`,
  );
  process.exit(1);
}
