#!/usr/bin/env -S node --import tsx
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validClasses = new Set(["C1", "C2", "C3", "C4", "C5"]);
const expectedDeckCount = 26;
const expectedClassifications = new Map(
  Object.entries({
    "deck.commands.discover": "C1",
    "deck.agents.detail": "C1",
    "deck.agents.skills.get": "C1",
    "deck.agents.subagents.get": "C1",
    "models.configured": "C1",
    "sessions.usage": "C1",
    "sessions.usage.logs": "C1",
    "sessions.usage.timeseries": "C1",
    "deck.routing.add": "C2",
    "deck.routing.remove": "C2",
    "deck.agents.skills.set": "C2",
    "deck.agents.subagents.set": "C2",
    "deck.agents.eventStreams.set": "C2",
    "deck.identity.link": "C2",
    "deck.identity.unlink": "C2",
    "deck.subagents.kill": "C2",
    "deck.subagents.steer": "C2",
    "sessions.clear": "C2",
    "sessions.steer": "C2",
    "deck.routing.list": "C3",
    "deck.subagents.list": "C3",
    "deck.subagents.lineage": "C3",
    "deck.identity.list": "C3",
    "deck.threads.list": "C3",
    "deck.auth.overview": "C4",
    "deck.auth.probe": "C4",
    "deck.routing.validate": "C4",
    "deck.routing.simulate": "C4",
    "deck.agents.toolPolicy.preview": "C4",
    "deck.agents.systemPrompt.preview": "C4",
    "deck.agents.eventStreams.get": "C4",
    "deck.plugins.list": "C4",
    "models.catalog.providers": "C4",
    "gateway.describe": "C5",
  }),
);

function parseArgs() {
  return {
    registryOnly: process.argv.includes("--registry-only"),
    json: process.argv.includes("--json"),
  };
}

function readSource(repoPath) {
  return readFileSync(path.join(repoRoot, repoPath), "utf8");
}

function createSourceFile(repoPath) {
  return ts.createSourceFile(repoPath, readSource(repoPath), ts.ScriptTarget.Latest, true);
}

function collectStringArrayVariable(repoPath, variableName): Set<string> {
  const sourceFile = createSourceFile(repoPath);
  const values = new Set<string>();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const element of node.initializer.elements) {
        if (ts.isStringLiteral(element)) {
          values.add(element.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return values;
}

function listSourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(path.join(repoRoot, root), { withFileTypes: true })) {
    const fullRepoPath = path.posix.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullRepoPath));
    } else if (
      entry.isFile() &&
      fullRepoPath.endsWith(".ts") &&
      !fullRepoPath.endsWith(".test.ts")
    ) {
      files.push(fullRepoPath);
    }
  }
  return files.toSorted((left, right) => left.localeCompare(right));
}

function collectDeckSourceMethods(): Set<string> {
  const files = [
    ...listSourceFiles("src/gateway/server-methods/deck"),
    "src/gateway/server-methods/deck-auth.ts",
  ].filter((repoPath) => statSync(path.join(repoRoot, repoPath)).isFile());
  const methods = new Set<string>();
  for (const file of files) {
    const sourceFile = createSourceFile(file);
    const visit = (node) => {
      if (ts.isPropertyAssignment(node)) {
        const name = propertyNameText(node.name);
        if (name?.startsWith("deck.")) {
          methods.add(name);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return methods;
}

function propertyNameText(name) {
  if (ts.isStringLiteral(name) || ts.isIdentifier(name)) {
    return name.text;
  }
  return null;
}

function collectForkClassAnnotations() {
  const files = [
    ...listSourceFiles("src/gateway/server-methods"),
    "src/gateway/method-registry-data.ts",
  ];
  const annotations = new Map();
  for (const file of files) {
    const sourceFile = createSourceFile(file);
    const visit = (node) => {
      if (!ts.isPropertyAssignment(node)) {
        ts.forEachChild(node, visit);
        return;
      }
      const method = propertyNameText(node.name);
      if (
        !method ||
        !expectedClassifications.has(method) ||
        !ts.isObjectLiteralExpression(node.initializer)
      ) {
        ts.forEachChild(node, visit);
        return;
      }
      let forkClass = null;
      let bffEligible = null;
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }
        const key = propertyNameText(property.name);
        if (key === "forkClass" && ts.isStringLiteral(property.initializer)) {
          forkClass = property.initializer.text;
        }
        if (key === "bffEligible") {
          bffEligible =
            property.initializer.kind === ts.SyntaxKind.TrueKeyword
              ? true
              : property.initializer.kind === ts.SyntaxKind.FalseKeyword
                ? false
                : null;
        }
      }
      annotations.set(method, { forkClass, bffEligible, file });
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return annotations;
}

function sorted(values) {
  return [...values].toSorted((left, right) => left.localeCompare(right));
}

function setDiff(left, right) {
  return sorted(left).filter((value) => !right.has(value));
}

function printProblems(problems) {
  for (const problem of problems) {
    console.error(`FAIL\t${problem}`);
  }
}

const options = parseArgs();
const methodRegistryDeck = new Set(
  sorted(
    collectStringArrayVariable("src/gateway/method-registry-data.ts", "allMethodNames"),
  ).filter((method) => method.startsWith("deck.")),
);
const serverMethodListSource = readSource("src/gateway/server-methods-list.ts");
const serverMethodListBaseMethods = collectStringArrayVariable(
  "src/gateway/server-methods-list.ts",
  "BASE_METHODS",
);
const serverMethodListDeck = new Set(
  sorted(
    serverMethodListBaseMethods.size > 0 &&
      !serverMethodListSource.includes("gatewayMethodRegistry.listMethods()")
      ? serverMethodListBaseMethods
      : methodRegistryDeck,
  ).filter((method) => method.startsWith("deck.")),
);
const deckSourceMethods = collectDeckSourceMethods();

const registryProblems: string[] = [];
const registrySets: Array<[string, Set<string>]> = [
  ["method-registry-data", methodRegistryDeck],
  ["server-methods-list", serverMethodListDeck],
  ["deck source", deckSourceMethods],
];
for (const [label, methods] of registrySets) {
  if (methods.size !== expectedDeckCount) {
    registryProblems.push(`${label} deck.* count=${methods.size}, expected=${expectedDeckCount}`);
  }
}
for (const missing of setDiff(deckSourceMethods, methodRegistryDeck)) {
  registryProblems.push(`method-registry-data missing ${missing}`);
}
for (const missing of setDiff(deckSourceMethods, serverMethodListDeck)) {
  registryProblems.push(`server-methods-list missing ${missing}`);
}
for (const extra of setDiff(methodRegistryDeck, deckSourceMethods)) {
  registryProblems.push(`method-registry-data extra ${extra}`);
}
for (const extra of setDiff(serverMethodListDeck, deckSourceMethods)) {
  registryProblems.push(`server-methods-list extra ${extra}`);
}

if (options.registryOnly) {
  const result = {
    mode: "registry-only",
    expectedDeckCount,
    methodRegistryDeck: sorted(methodRegistryDeck),
    serverMethodListDeck: sorted(serverMethodListDeck),
    deckSourceMethods: sorted(deckSourceMethods),
    problems: registryProblems,
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`registry-only deck.* count=${deckSourceMethods.size}`);
    printProblems(registryProblems);
  }
  if (registryProblems.length > 0) {
    process.exitCode = 1;
  }
} else {
  const annotations = collectForkClassAnnotations();
  const classificationProblems = [...registryProblems];
  const totals = new Map([
    ["C1", 0],
    ["C2", 0],
    ["C3", 0],
    ["C4", 0],
    ["C5", 0],
  ]);
  for (const [method, expected] of expectedClassifications) {
    const annotation = annotations.get(method);
    if (!annotation?.forkClass) {
      classificationProblems.push(`${method} missing forkClass annotation`);
      continue;
    }
    if (!validClasses.has(annotation.forkClass)) {
      classificationProblems.push(`${method} invalid forkClass=${annotation.forkClass}`);
      continue;
    }
    if (annotation.forkClass !== expected) {
      classificationProblems.push(
        `${method} forkClass=${annotation.forkClass}, expected=${expected}`,
      );
    }
    if (expected === "C3" && annotation.bffEligible !== true) {
      classificationProblems.push(`${method} is C3 but bffEligible is not true`);
    }
    totals.set(annotation.forkClass, (totals.get(annotation.forkClass) ?? 0) + 1);
  }
  const expectedTotals = new Map([
    ["C1", 8],
    ["C2", 11],
    ["C3", 5],
    ["C4", 9],
    ["C5", 1],
  ]);
  for (const [forkClass, expected] of expectedTotals) {
    const actual = totals.get(forkClass) ?? 0;
    if (actual !== expected) {
      classificationProblems.push(`${forkClass} total=${actual}, expected=${expected}`);
    }
  }
  const result = {
    mode: "strict",
    expectedClassifications: Object.fromEntries(expectedClassifications),
    totals: Object.fromEntries(totals),
    problems: classificationProblems,
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `strict classification totals ${[...totals].map(([key, value]) => `${key}=${value}`).join(" ")}`,
    );
    printProblems(classificationProblems);
  }
  if (classificationProblems.length > 0) {
    process.exitCode = 1;
  }
}
