import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { DECK_GO_ROOT } from "./protocol-common.js";

type Finding = {
  file: string;
  line: number;
  method?: string;
  reason?: string;
  text: string;
  type: "go-untyped" | "fe-gateway-proxy";
};

type ClassifiedEndpoint = {
  category: string;
  migrationTarget: string;
  path: string;
};

type ContractException = {
  exitCriteria?: string;
  id?: string;
  method?: string;
  owner?: string;
  reason?: string;
};

const GATEWAY_ADAPTER_CATEGORY = "gateway-protocol-adapter";

const GO_SCAN_DIRS = [
  resolve(DECK_GO_ROOT, "backend/internal/runtime/openclaw"),
  resolve(DECK_GO_ROOT, "backend/internal/handlers"),
];
const FE_SCAN_DIR = resolve(DECK_GO_ROOT, "frontend/src");
const CLASSIFICATION_DOC = resolve(DECK_GO_ROOT, "docs/fe-endpoint-classification.md");
const EXCEPTIONS_DOC = resolve(DECK_GO_ROOT, "docs/gateway-untyped-exceptions.md");
const EXCEPTIONS_SOURCE = resolve(DECK_GO_ROOT, "contracts/source/deck-exceptions.contract.json");

function repoPath(path: string): string {
  return relative(DECK_GO_ROOT, path).replaceAll("\\", "/");
}

function walk(dir: string, extensions: Set<string>): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path, extensions));
    } else if (extensions.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files.toSorted((a, b) => a.localeCompare(b));
}

function reasonFrom(line: string, marker: string): string | undefined {
  const index = line.indexOf(marker);
  if (index < 0) {
    return undefined;
  }
  return line.slice(index + marker.length).trim();
}

function scanGo(): { exceptions: Finding[]; violations: Finding[] } {
  const exceptions: Finding[] = [];
  const violations: Finding[] = [];
  const requestPattern = /\.Request\s*\(\s*ctx\s*,\s*"([^"]+)"/g;

  for (const file of GO_SCAN_DIRS.flatMap((dir) => walk(dir, new Set([".go"])))) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const match of line.matchAll(requestPattern)) {
        const method = match[1];
        const reason = reasonFrom(line, "gateway:allow-untyped reason:");
        const finding: Finding = {
          file: repoPath(file),
          line: index + 1,
          method,
          reason,
          text: line.trim(),
          type: "go-untyped",
        };
        if (reason) {
          exceptions.push(finding);
        } else {
          violations.push(finding);
        }
      }
    });
  }

  return { exceptions, violations };
}

function parseClassification(): ClassifiedEndpoint[] {
  if (!existsSync(CLASSIFICATION_DOC)) {
    throw new Error(`missing ${repoPath(CLASSIFICATION_DOC)}`);
  }
  const endpoints: ClassifiedEndpoint[] = [];
  for (const rawLine of readFileSync(CLASSIFICATION_DOC, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("| `")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2 || cells[0] === "---") {
      continue;
    }
    const category = cells[1].replace(/^`|`$/g, "");
    const pathMatches = [...cells[0].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    const paths = pathMatches.length > 0 ? pathMatches : [cells[0].replace(/^`|`$/g, "")];
    for (const path of paths) {
      endpoints.push({ path, category, migrationTarget: cells[2]?.replace(/^`|`$/g, "") ?? "" });
    }
  }
  return endpoints;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function endpointApiPath(endpoint: string): string | undefined {
  const parts = endpoint.trim().split(/\s+/);
  const path = parts.at(-1);
  if (!path || path.includes("/gateway/rpc")) {
    return undefined;
  }
  return path.startsWith("/api/") ? path : `/api${path}`;
}

function endpointPattern(endpoint: string, ambiguousPaths: Set<string>): RegExp | undefined {
  const normalized = endpointApiPath(endpoint);
  if (!normalized || ambiguousPaths.has(normalized)) {
    return undefined;
  }
  if (!normalized.includes("{")) {
    return new RegExp(`${escapeRegExp(normalized)}(?=["'\`])`);
  }
  const body = normalized
    .split(/(\{[^}]+\})/)
    .map((part) => (part.startsWith("{") ? `[^"']+` : escapeRegExp(part)))
    .join("");
  return new RegExp(body);
}

function scanFrontend(): Finding[] {
  const endpoints = parseClassification();
  const categoriesByPath = new Map<string, Set<string>>();
  for (const endpoint of endpoints) {
    const path = endpointApiPath(endpoint.path);
    if (!path) {
      continue;
    }
    const categories = categoriesByPath.get(path) ?? new Set<string>();
    categories.add(endpoint.category);
    categoriesByPath.set(path, categories);
  }
  const ambiguousPaths = new Set(
    [...categoriesByPath.entries()]
      .filter(([, categories]) => categories.has(GATEWAY_ADAPTER_CATEGORY) && categories.size > 1)
      .map(([path]) => path),
  );
  const gatewayProxyPatterns = endpoints
    .filter(
      (endpoint) =>
        endpoint.category === GATEWAY_ADAPTER_CATEGORY &&
        endpoint.migrationTarget.startsWith("gw."),
    )
    .map((endpoint) => ({ endpoint, pattern: endpointPattern(endpoint.path, ambiguousPaths) }))
    .filter((entry): entry is { endpoint: ClassifiedEndpoint; pattern: RegExp } =>
      Boolean(entry.pattern),
    );
  const violations: Finding[] = [];

  for (const file of walk(FE_SCAN_DIR, new Set([".ts", ".tsx"]))) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (reasonFrom(line, "fe-gateway-allow-untyped reason:")) {
        return;
      }
      for (const { endpoint, pattern } of gatewayProxyPatterns) {
        if (pattern.test(line)) {
          violations.push({
            file: repoPath(file),
            line: index + 1,
            reason: endpoint.path,
            text: line.trim(),
            type: "fe-gateway-proxy",
          });
        }
      }
    });
  }

  return violations;
}

function readExceptionRegistry(): Map<string, ContractException> {
  if (!existsSync(EXCEPTIONS_SOURCE)) {
    return new Map();
  }
  const contract = JSON.parse(readFileSync(EXCEPTIONS_SOURCE, "utf8")) as {
    exceptions?: ContractException[];
  };
  const byMethod = new Map<string, ContractException>();
  for (const exception of contract.exceptions ?? []) {
    if (exception.method) {
      byMethod.set(exception.method, exception);
    }
  }
  return byMethod;
}

function writeExceptions(
  exceptions: Finding[],
  exceptionRegistry: Map<string, ContractException>,
): void {
  mkdirSync(dirname(EXCEPTIONS_DOC), { recursive: true });
  const lines = [
    "# Gateway Untyped Exceptions",
    "",
    "Generated by `make gateway-typecheck` from inline allow markers and `deck-go/contracts/source/deck-exceptions.contract.json`.",
    "",
    "| Source | Method | Registry ID | Owner | Inline reason | Registry reason | Exit criteria |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const finding of exceptions.toSorted((a, b) =>
    `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`),
  )) {
    const registered = finding.method ? exceptionRegistry.get(finding.method) : undefined;
    lines.push(
      `| \`${finding.file}:${finding.line}\` | \`${finding.method ?? ""}\` | \`${registered?.id ?? "missing-registry-record"}\` | ${registered?.owner ?? ""} | ${finding.reason ?? ""} | ${registered?.reason ?? ""} | ${registered?.exitCriteria ?? ""} |`,
    );
  }
  if (exceptions.length === 0) {
    lines.push("| n/a | n/a | n/a | n/a | n/a | n/a | n/a |");
  }
  lines.push("");
  writeFileSync(EXCEPTIONS_DOC, lines.join("\n"), "utf8");
}

function main(): void {
  const go = scanGo();
  const feViolations = scanFrontend();
  const exceptionRegistry = readExceptionRegistry();
  const undocumentedGoExceptions = go.exceptions
    .filter((finding) => !finding.method || !exceptionRegistry.has(finding.method))
    .map((finding) => ({
      ...finding,
      reason: "missing exception registry record",
    }));
  const violations = [...go.violations, ...undocumentedGoExceptions, ...feViolations];
  writeExceptions(go.exceptions, exceptionRegistry);

  if (violations.length > 0) {
    for (const finding of violations) {
      console.error(
        `untyped-call: ${finding.file}:${finding.line} ${finding.method ?? finding.reason ?? ""}`,
      );
      console.error(`  ${finding.text}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `gateway-typecheck ok: ${go.exceptions.length} go exception(s), ${feViolations.length} fe violation(s)`,
  );
}

main();
