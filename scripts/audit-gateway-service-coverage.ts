#!/usr/bin/env -S node --import tsx
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sortStrings = (values: Iterable<string>) =>
  [...values].toSorted((left, right) => left.localeCompare(right));

type ImportedBinding = {
  importer: string;
  source: string;
  importedName: string;
  localName: string;
  key: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { fixtures: "", expected: "", json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--fixtures") {
      options.fixtures = args[++index] ?? "";
    } else if (arg === "--expected") {
      options.expected = args[++index] ?? "";
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function repoPath(fullPath) {
  return path.relative(repoRoot, fullPath).split(path.sep).join("/");
}

function readSource(filePath) {
  return readFileSync(path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath), "utf8");
}

function listTypeScriptFiles(rootPath) {
  const absolute = path.isAbsolute(rootPath) ? rootPath : path.join(repoRoot, rootPath);
  const stats = statSync(absolute);
  if (stats.isFile()) {
    return absolute.endsWith(".ts") && !absolute.endsWith(".test.ts") ? [absolute] : [];
  }
  return readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => listTypeScriptFiles(path.join(absolute, entry.name)))
    .toSorted((left, right) => left.localeCompare(right));
}

function resolveImport(importerRepoPath, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(importerRepoPath), specifier),
  );
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`];
  for (const candidate of candidates) {
    if (statExists(path.join(repoRoot, candidate))) {
      return candidate.replace(/\.js$/, ".ts");
    }
  }
  return base.replace(/\.js$/, ".ts");
}

function statExists(filePath) {
  try {
    statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function isInternalDependency(resolvedRepoPath) {
  if (!resolvedRepoPath) {
    return false;
  }
  return (
    !resolvedRepoPath.startsWith("src/gateway/server-methods/") &&
    !resolvedRepoPath.startsWith("src/gateway/protocol/") &&
    !resolvedRepoPath.startsWith("src/gateway/services/")
  );
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  return null;
}

function collectImportedBindingsFromSource(filePath): ImportedBinding[] {
  const importerRepoPath = path.isAbsolute(filePath) ? repoPath(filePath) : filePath;
  const sourceFile = ts.createSourceFile(
    importerRepoPath,
    readSource(filePath),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports: ImportedBinding[] = [];
  const addImport = (specifier, importedName, localName) => {
    const resolved = resolveImport(importerRepoPath, specifier);
    if (!isInternalDependency(resolved)) {
      return;
    }
    imports.push({
      importer: importerRepoPath,
      source: resolved,
      importedName,
      localName,
      key: `${importedName}:${resolved}`,
    });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      if (!clause || clause.isTypeOnly) {
        ts.forEachChild(node, visit);
        return;
      }
      if (clause.name) {
        addImport(specifier, "default", clause.name.text);
      }
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (!element.isTypeOnly) {
            addImport(specifier, (element.propertyName ?? element.name).text, element.name.text);
          }
        }
      } else if (bindings && ts.isNamespaceImport(bindings)) {
        addImport(specifier, "*", bindings.name.text);
      }
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      let current = node.parent;
      while (current && !ts.isVariableDeclaration(current)) {
        current = current.parent;
      }
      if (current && ts.isObjectBindingPattern(current.name)) {
        for (const element of current.name.elements) {
          const name = propertyNameText(element.propertyName ?? element.name);
          const localName = ts.isIdentifier(element.name) ? element.name.text : name;
          if (name && localName) {
            addImport(specifier, name, localName);
          }
        }
      } else {
        addImport(specifier, "*", "dynamicImport");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return imports;
}

function collectDeckHandlerFiles() {
  return [
    ...listTypeScriptFiles("src/gateway/server-methods/deck"),
    path.join(repoRoot, "src/gateway/server-methods/deck-auth.ts"),
    path.join(repoRoot, "src/gateway/server-methods/models-configured.ts"),
  ];
}

function collectServiceCoveredSymbols() {
  const servicesDir = path.join(repoRoot, "src/gateway/services");
  if (!statExists(servicesDir)) {
    return new Set();
  }
  const covered = new Set<string>();
  for (const file of listTypeScriptFiles(servicesDir)) {
    for (const entry of collectImportedBindingsFromSource(file)) {
      covered.add(entry.importedName);
      covered.add(entry.localName);
    }
  }
  return covered;
}

function collectEscapeHatches() {
  const readme = path.join(repoRoot, "src/gateway/services/README.md");
  if (!statExists(readme)) {
    return new Set();
  }
  const text = readFileSync(readme, "utf8");
  return new Set([...text.matchAll(/`([A-Za-z_$][\w$]*)`/g)].map((match) => match[1]));
}

function runFixtureMode(options) {
  if (!options.expected) {
    throw new Error("--fixtures requires --expected <json>");
  }
  const actual = new Set<string>();
  for (const file of listTypeScriptFiles(options.fixtures)) {
    for (const entry of collectImportedBindingsFromSource(file)) {
      actual.add(
        entry.importedName === "default" || entry.importedName === "*"
          ? entry.localName
          : entry.importedName,
      );
    }
  }
  const expectedJson = JSON.parse(readFileSync(path.join(repoRoot, options.expected), "utf8")) as
    | {
        symbols?: string[];
      }
    | string[];
  const expectedValues = Array.isArray(expectedJson) ? expectedJson : (expectedJson.symbols ?? []);
  const expected = new Set(expectedValues);
  const missing = sortStrings([...expected].filter((symbol) => !actual.has(symbol)));
  const extra = sortStrings([...actual].filter((symbol) => !expected.has(symbol)));
  const result = {
    mode: "fixtures",
    expected: sortStrings(expected),
    actual: sortStrings(actual),
    missing,
    extra,
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`fixture service-coverage symbols=${actual.size}`);
    for (const symbol of missing) {
      console.error(`FAIL\tmissing expected symbol ${symbol}`);
    }
    for (const symbol of extra) {
      console.error(`FAIL\textra symbol ${symbol}`);
    }
  }
  if (missing.length > 0 || extra.length > 0) {
    process.exitCode = 1;
  }
}

function runDefaultMode(options) {
  const consumed = collectDeckHandlerFiles().flatMap((file) =>
    collectImportedBindingsFromSource(file),
  );
  const covered = collectServiceCoveredSymbols();
  const escapeHatches = collectEscapeHatches();
  const escaped = consumed.filter((entry) => escapeHatches.has(entry.importedName));
  const unmapped = consumed.filter(
    (entry) =>
      !covered.has(entry.importedName) &&
      !covered.has(entry.localName) &&
      !escapeHatches.has(entry.importedName),
  );
  const result = {
    mode: "default",
    consumed,
    covered: sortStrings(covered),
    escapeHatches: sortStrings(escapeHatches),
    unmapped,
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`gateway service coverage consumed=${consumed.length} unmapped=${unmapped.length}`);
    if (escaped.length > 0) {
      console.log(
        `# documented escape hatches consumed=${escaped.length}: ${sortStrings(
          escaped.map((entry) => entry.importedName),
        ).join(", ")}`,
      );
    }
    for (const entry of unmapped) {
      console.error(`FAIL\t${entry.importer}: ${entry.importedName} from ${entry.source}`);
    }
  }
  if (unmapped.length > 0) {
    process.exitCode = 1;
  }
}

const options = parseArgs();
if (options.fixtures) {
  runFixtureMode(options);
} else {
  runDefaultMode(options);
}
