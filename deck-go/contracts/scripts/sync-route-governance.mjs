import { existsSync, readFileSync, readdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const root = new URL("../", import.meta.url);
const deckGoRoot = path.resolve(root.pathname, "..");
const repoRoot = path.resolve(deckGoRoot, "..");
const serverRoot = path.join(deckGoRoot, "backend/internal/server");
const endpointContractPath = path.join(deckGoRoot, "contracts/source/deck-endpoints.contract.json");
const governancePath = path.join(
  deckGoRoot,
  "contracts/source/deck-route-governance.contract.json",
);
const jsonOutPath = path.join(deckGoRoot, "docs/route-governance.json");
const markdownOutPath = path.join(deckGoRoot, "docs/route-governance.md");
const checkMode = process.env.CHECK_MODE === "1";

const allowedContractAuthorities = new Set([
  "binary-static",
  "deck-api-dto",
  "deck-stream",
  "documented-exception",
  "gateway-transport",
]);
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

function normalizePath(routePath) {
  const withoutQuery = routePath.split("?")[0];
  return withoutQuery.startsWith("/api/") || withoutQuery.startsWith("/v1/")
    ? withoutQuery
    : `/api${withoutQuery.startsWith("/") ? "" : "/"}${withoutQuery}`;
}

function normalizeEndpointKey(method, routePath) {
  return `${method.toUpperCase()} ${normalizePath(routePath)}`;
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

function collectRegisteredRoutes() {
  const routes = [];
  const pattern = /MethodFunc\(\s*(?:"([^"]+)"|http\.Method([A-Za-z]+))\s*,\s*"([^"]+)"/g;
  for (const file of walk(
    serverRoot,
    (entry) => entry.endsWith(".go") && !entry.endsWith("_test.go"),
  )) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const match of line.matchAll(pattern)) {
        const method = normalizeMethod(match[1] ?? `http.Method${match[2]}`);
        const routePath = `${endpointPrefix(file)}${match[3]}`;
        routes.push({
          file: repoPath(file),
          key: normalizeEndpointKey(method, routePath),
          line: index + 1,
          method,
          path: normalizePath(routePath),
        });
      }
    });
  }
  return routes.toSorted((a, b) => a.key.localeCompare(b.key));
}

function collectClassifiedEndpoints(contract) {
  const endpoints = [];
  const issues = [];
  for (const endpoint of contract.endpoints ?? []) {
    if (!allowedEndpointCategories.has(endpoint.category)) {
      issues.push(
        `unknown endpoint category for ${endpoint.paths?.join(", ") ?? "<missing>"}: ${endpoint.category}`,
      );
    }
    for (const entry of endpoint.paths ?? []) {
      const [method, ...pathParts] = entry.trim().split(/\s+/);
      const routePath = pathParts.join(" ");
      if (!method || !routePath) {
        issues.push(`invalid endpoint path entry: ${entry}`);
        continue;
      }
      const normalizedPath = normalizePath(routePath);
      endpoints.push({
        category: endpoint.category,
        key: normalizeEndpointKey(method, routePath),
        method: method.toUpperCase(),
        migrationTarget: endpoint.migrationTarget ?? "",
        notes: endpoint.notes ?? "",
        pathPattern: routePattern(normalizedPath),
        pathTemplate: normalizedPath,
      });
    }
  }
  return { endpoints, issues };
}

function findClassification(route, classifiedEndpoints) {
  return classifiedEndpoints.find(
    (endpoint) => endpoint.method === route.method && endpoint.pathPattern.test(route.path),
  );
}

function findOwner(route, owners) {
  const matches = [];
  for (const owner of owners) {
    for (const matcher of owner.matches ?? []) {
      const method = (matcher.method ?? "*").toUpperCase();
      if (method !== "*" && method !== route.method) {
        continue;
      }
      const pathPrefix = normalizePath(matcher.pathPrefix ?? "");
      if (pathPrefix && route.path.startsWith(pathPrefix)) {
        matches.push({ owner, specificity: pathPrefix.length });
      }
    }
  }
  matches.sort((a, b) => b.specificity - a.specificity || a.owner.id.localeCompare(b.owner.id));
  return matches[0]?.owner;
}

function validateReferenceList(errors, owner, field) {
  const values = owner[field];
  if (!Array.isArray(values) || values.length === 0) {
    errors.push(`${owner.id}.${field} must be a non-empty array`);
    return;
  }
  for (const value of values) {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${owner.id}.${field} includes a blank reference`);
      continue;
    }
    if (/^(deferred|none|n\/a|external):/.test(value)) {
      continue;
    }
    const clean = value.split("#")[0];
    if (!existsSync(path.join(repoRoot, clean))) {
      errors.push(`${owner.id}.${field} references missing path ${value}`);
    }
  }
}

function validateGovernanceSource(contract) {
  const errors = [];
  if (contract.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (contract.sourceAudited !== "deck-go/frontend-new/src/api.ts") {
    errors.push("sourceAudited must be deck-go/frontend-new/src/api.ts");
  }
  if (!Array.isArray(contract.owners)) {
    errors.push("owners must be an array");
    return errors;
  }
  const ids = new Set();
  for (const owner of contract.owners) {
    if (!owner.id || ids.has(owner.id)) {
      errors.push(`owner id missing or duplicate: ${owner.id ?? "<missing>"}`);
    }
    ids.add(owner.id);
    for (const field of ["module", "contractAuthority"]) {
      if (typeof owner[field] !== "string" || owner[field].trim() === "") {
        errors.push(`${owner.id ?? "<missing>"}.${field} must be a non-empty string`);
      }
    }
    if (!allowedContractAuthorities.has(owner.contractAuthority)) {
      errors.push(
        `${owner.id}.contractAuthority must be one of ${Array.from(allowedContractAuthorities).join(", ")}`,
      );
    }
    if (!Array.isArray(owner.matches) || owner.matches.length === 0) {
      errors.push(`${owner.id}.matches must be a non-empty array`);
    }
    validateReferenceList(errors, owner, "contractRefs");
    validateReferenceList(errors, owner, "frontendFacade");
    validateReferenceList(errors, owner, "mockEvidence");
    validateReferenceList(errors, owner, "realEvidence");
  }
  return errors;
}

function buildReport(routes, classifiedEndpoints, governance) {
  const rows = [];
  const errors = [...validateGovernanceSource(governance)];

  for (const route of routes) {
    const classification = findClassification(route, classifiedEndpoints);
    const owner = findOwner(route, governance.owners ?? []);
    if (!classification) {
      errors.push(`missing endpoint classification for ${route.key} (${route.file}:${route.line})`);
    }
    if (!owner) {
      errors.push(`missing route governance owner for ${route.key} (${route.file}:${route.line})`);
    }
    rows.push({
      ...route,
      category: classification?.category ?? "missing",
      contractAuthority: owner?.contractAuthority ?? "missing",
      contractRefs: owner?.contractRefs ?? [],
      frontendFacade: owner?.frontendFacade ?? [],
      migrationTarget: classification?.migrationTarget ?? "",
      module: owner?.module ?? "missing",
      owner: owner?.id ?? "missing",
      realEvidence: owner?.realEvidence ?? [],
      mockEvidence: owner?.mockEvidence ?? [],
    });
  }

  return {
    schemaVersion: 1,
    generatedFrom: [
      repoPath(endpointContractPath),
      repoPath(governancePath),
      "deck-go/backend/internal/server/**/*.go",
    ],
    generatedAt: "deterministic",
    totals: {
      registeredRoutes: routes.length,
      governedRoutes: rows.filter((row) => row.owner !== "missing").length,
      classifiedRoutes: rows.filter((row) => row.category !== "missing").length,
      owners: governance.owners?.length ?? 0,
      errors: errors.length,
    },
    errors,
    routes: rows,
  };
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderMarkdown(report) {
  const lines = [
    "# Deck Go Route Governance",
    "",
    "Generated from `deck-go/contracts/source/deck-route-governance.contract.json`, `deck-go/contracts/source/deck-endpoints.contract.json`, and Go route registrations.",
    "",
    `Registered routes: ${report.totals.registeredRoutes}`,
    `Governed routes: ${report.totals.governedRoutes}`,
    `Classified routes: ${report.totals.classifiedRoutes}`,
    `Errors: ${report.totals.errors}`,
    "",
  ];

  if (report.errors.length > 0) {
    lines.push("## Errors", "");
    for (const error of report.errors) {
      lines.push(`- ${error}`);
    }
    lines.push("");
  }

  lines.push(
    "## Routes",
    "",
    "| Route | Owner | Category | Contract authority | Frontend facade | Mock evidence | Real evidence | Source |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const route of report.routes) {
    lines.push(
      `| \`${escapeCell(route.key)}\` | \`${escapeCell(route.owner)}\` | \`${escapeCell(route.category)}\` | \`${escapeCell(route.contractAuthority)}\` | ${route.frontendFacade.map((entry) => `\`${escapeCell(entry)}\``).join("<br>")} | ${route.mockEvidence.map((entry) => `\`${escapeCell(entry)}\``).join("<br>")} | ${route.realEvidence.map((entry) => `\`${escapeCell(entry)}\``).join("<br>")} | \`${route.file}:${route.line}\` |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const endpointContract = JSON.parse(await fs.readFile(endpointContractPath, "utf8"));
  const governance = JSON.parse(await fs.readFile(governancePath, "utf8"));
  const { endpoints, issues } = collectClassifiedEndpoints(endpointContract);
  const routes = collectRegisteredRoutes();
  const report = buildReport(routes, endpoints, governance);
  report.errors.unshift(...issues);
  report.totals.errors = report.errors.length;

  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);

  if (report.errors.length > 0) {
    console.error(report.errors.map((error) => `ERROR: ${error}`).join("\n"));
    process.exit(1);
  }

  if (checkMode) {
    const [actualJson, actualMarkdown] = await Promise.all([
      fs.readFile(jsonOutPath, "utf8"),
      fs.readFile(markdownOutPath, "utf8"),
    ]);
    if (actualJson !== json) {
      console.error(
        "route-governance.json is stale. Run: node contracts/scripts/sync-route-governance.mjs",
      );
      process.exit(1);
    }
    if (actualMarkdown !== markdown) {
      console.error(
        "route-governance.md is stale. Run: node contracts/scripts/sync-route-governance.mjs",
      );
      process.exit(1);
    }
    console.log(`route governance is up to date (${report.totals.registeredRoutes} routes)`);
    return;
  }

  await fs.writeFile(jsonOutPath, json, "utf8");
  await fs.writeFile(markdownOutPath, markdown, "utf8");
  console.log(`wrote ${jsonOutPath}`);
  console.log(`wrote ${markdownOutPath}`);
}

await main();
