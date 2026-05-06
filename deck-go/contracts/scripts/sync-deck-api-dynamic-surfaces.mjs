import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const deckGoRoot = path.resolve(root.pathname, "..");
const sourcePath = new URL("source/deck-api.contract.ts", root);
const classificationPath = new URL("source/deck-api-dynamic-surfaces.contract.json", root);
const jsonOutPath = new URL("../docs/deck-api-dynamic-surfaces.json", root);
const markdownOutPath = new URL("../docs/deck-api-dynamic-surfaces.md", root);
const checkMode = process.env.CHECK_MODE === "1";
const printInventory = process.argv.includes("--print-inventory");

function repoPath(filePath) {
  return path.relative(path.resolve(deckGoRoot, ".."), filePath).replaceAll(path.sep, "/");
}

function lineFor(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function fieldNameText(name, sourceFile) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText(sourceFile);
}

function recordValueType(node) {
  if (!ts.isTypeReferenceNode(node) || node.typeName.getText() !== "Record") {
    return undefined;
  }
  const args = node.typeArguments;
  if (!args || args.length !== 2 || args[0].kind !== ts.SyntaxKind.StringKeyword) {
    return undefined;
  }
  return args[1];
}

function isUnknownLike(node) {
  return node.kind === ts.SyntaxKind.UnknownKeyword || node.kind === ts.SyntaxKind.AnyKeyword;
}

function addOccurrence(occurrences, sourceFile, node, surface, kind) {
  const typeText = node.getText(sourceFile);
  occurrences.push({
    surface,
    kind,
    line: lineFor(sourceFile, node),
    type: typeText,
  });
}

function collectDynamicLeavesFromType(occurrences, sourceFile, node, surface) {
  if (!node) {
    return;
  }

  const recordValue = recordValueType(node);
  if (recordValue) {
    if (isUnknownLike(recordValue)) {
      addOccurrence(occurrences, sourceFile, node, surface, "record-unknown");
      return;
    }
    collectDynamicLeavesFromType(occurrences, sourceFile, recordValue, surface);
    return;
  }

  if (isUnknownLike(node)) {
    addOccurrence(occurrences, sourceFile, node, surface, "unknown");
    return;
  }

  if (ts.isArrayTypeNode(node)) {
    const element = node.elementType;
    const elementRecordValue = recordValueType(element);
    if (elementRecordValue && isUnknownLike(elementRecordValue)) {
      addOccurrence(occurrences, sourceFile, node, surface, "array-record-unknown");
      return;
    }
    if (isUnknownLike(element)) {
      addOccurrence(occurrences, sourceFile, node, surface, "array-unknown");
      return;
    }
    collectDynamicLeavesFromType(occurrences, sourceFile, element, surface);
    return;
  }

  if (
    ts.isTypeReferenceNode(node) &&
    node.typeName.getText(sourceFile) === "Array" &&
    node.typeArguments?.length === 1
  ) {
    const element = node.typeArguments[0];
    const elementRecordValue = recordValueType(element);
    if (elementRecordValue && isUnknownLike(elementRecordValue)) {
      addOccurrence(occurrences, sourceFile, node, surface, "array-record-unknown");
      return;
    }
    if (isUnknownLike(element)) {
      addOccurrence(occurrences, sourceFile, node, surface, "array-unknown");
      return;
    }
    collectDynamicLeavesFromType(occurrences, sourceFile, element, surface);
    return;
  }

  if (ts.isParenthesizedTypeNode(node)) {
    collectDynamicLeavesFromType(occurrences, sourceFile, node.type, surface);
    return;
  }

  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    for (const part of node.types) {
      collectDynamicLeavesFromType(occurrences, sourceFile, part, surface);
    }
    return;
  }

  if (ts.isTypeLiteralNode(node)) {
    collectDynamicLeavesFromMembers(occurrences, sourceFile, node.members, surface);
  }
}

function collectDynamicLeavesFromMembers(occurrences, sourceFile, members, parentSurface) {
  for (const member of members) {
    if (ts.isPropertySignature(member) && member.type) {
      const surface = `${parentSurface}.${fieldNameText(member.name, sourceFile)}`;
      collectDynamicLeavesFromType(occurrences, sourceFile, member.type, surface);
      continue;
    }

    if (ts.isIndexSignatureDeclaration(member)) {
      const surface = `${parentSurface}.<index-signature>`;
      if (member.type && isUnknownLike(member.type)) {
        addOccurrence(occurrences, sourceFile, member, surface, "index-signature-unknown");
      } else if (member.type) {
        collectDynamicLeavesFromType(occurrences, sourceFile, member.type, surface);
      }
    }
  }
}

function isExported(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function collectDynamicLeaves(source) {
  const sourceFile = ts.createSourceFile(
    sourcePath.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const occurrences = [];

  for (const node of sourceFile.statements) {
    if (!isExported(node)) {
      continue;
    }
    if (ts.isInterfaceDeclaration(node)) {
      collectDynamicLeavesFromMembers(occurrences, sourceFile, node.members, node.name.text);
    } else if (ts.isTypeAliasDeclaration(node)) {
      collectDynamicLeavesFromType(occurrences, sourceFile, node.type, `${node.name.text}.<type>`);
    }
  }

  return occurrences.toSorted((a, b) => a.surface.localeCompare(b.surface));
}

function validateContract(contract, occurrences) {
  const errors = [];
  const occurrenceSurfaces = new Set(occurrences.map((entry) => entry.surface));
  const seen = new Set();
  const classifications = contract.classifications ?? [];

  if (contract.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (!Array.isArray(classifications)) {
    errors.push("classifications must be an array");
    return errors;
  }

  for (const entry of classifications) {
    const label = entry.surface ?? "<missing-surface>";
    for (const field of ["surface", "classification", "owner", "reason", "exitCriteria"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        errors.push(`${label} missing ${field}`);
      }
    }
    if (seen.has(entry.surface)) {
      errors.push(`duplicate classification surface: ${entry.surface}`);
    }
    seen.add(entry.surface);
    if (entry.surface && !occurrenceSurfaces.has(entry.surface)) {
      errors.push(`stale classification surface: ${entry.surface}`);
    }
  }

  for (const occurrence of occurrences) {
    if (!seen.has(occurrence.surface)) {
      errors.push(`missing classification surface: ${occurrence.surface}`);
    }
  }

  return errors;
}

function buildReport(contract, occurrences) {
  const classificationBySurface = new Map(
    (contract.classifications ?? []).map((entry) => [entry.surface, entry]),
  );
  return {
    schemaVersion: 1,
    generatedFrom: repoPath(sourcePath.pathname),
    classificationSource: repoPath(classificationPath.pathname),
    generatedAt: "deterministic",
    totals: {
      dynamicLeaves: occurrences.length,
      classifications: contract.classifications?.length ?? 0,
    },
    surfaces: occurrences.map((occurrence) => {
      const classification = classificationBySurface.get(occurrence.surface);
      return {
        ...occurrence,
        classification: classification?.classification ?? "missing",
        owner: classification?.owner ?? "",
        reason: classification?.reason ?? "",
        exitCriteria: classification?.exitCriteria ?? "",
      };
    }),
  };
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderMarkdown(report) {
  const lines = [
    "# Deck API Dynamic Surfaces",
    "",
    "Generated from `deck-go/contracts/source/deck-api-dynamic-surfaces.contract.json` and `deck-go/contracts/source/deck-api.contract.ts`.",
    "",
    "This report documents intentional dynamic leaves in the Deck-facing API. Code truth remains the source contract and generated artifacts.",
    "",
    `Dynamic leaves: ${report.totals.dynamicLeaves}`,
    "",
    "| Surface | Kind | Line | Classification | Owner | Reason | Exit criteria |",
    "| --- | --- | ---: | --- | --- | --- | --- |",
  ];

  for (const surface of report.surfaces) {
    lines.push(
      `| \`${escapeCell(surface.surface)}\` | \`${surface.kind}\` | ${surface.line} | \`${escapeCell(surface.classification)}\` | ${escapeCell(surface.owner)} | ${escapeCell(surface.reason)} | ${escapeCell(surface.exitCriteria)} |`,
    );
  }

  if (report.surfaces.length === 0) {
    lines.push("| n/a | n/a | n/a | n/a | n/a | n/a | n/a |");
  }

  lines.push("");
  return lines.join("\n");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  const source = await fs.readFile(sourcePath, "utf8");
  const occurrences = collectDynamicLeaves(source);

  if (printInventory) {
    console.log(JSON.stringify(occurrences, null, 2));
    return;
  }

  if (!existsSync(classificationPath.pathname)) {
    throw new Error(`missing ${repoPath(classificationPath.pathname)}`);
  }

  const contract = await readJson(classificationPath);
  const errors = validateContract(contract, occurrences);
  if (errors.length > 0) {
    console.error(errors.map((error) => `ERROR: ${error}`).join("\n"));
    process.exit(1);
  }

  const report = buildReport(contract, occurrences);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);

  if (checkMode) {
    const [actualJson, actualMarkdown] = await Promise.all([
      fs.readFile(jsonOutPath, "utf8"),
      fs.readFile(markdownOutPath, "utf8"),
    ]);
    if (actualJson !== json) {
      console.error(
        "deck-api-dynamic-surfaces.json is stale. Run: node contracts/scripts/sync-deck-api-dynamic-surfaces.mjs",
      );
      process.exit(1);
    }
    if (actualMarkdown !== markdown) {
      console.error(
        "deck-api-dynamic-surfaces.md is stale. Run: node contracts/scripts/sync-deck-api-dynamic-surfaces.mjs",
      );
      process.exit(1);
    }
    console.log(`deck-api dynamic surfaces are up to date (${report.totals.dynamicLeaves} leaves)`);
    return;
  }

  await fs.writeFile(jsonOutPath, json, "utf8");
  await fs.writeFile(markdownOutPath, markdown, "utf8");
  console.log(`wrote ${jsonOutPath.pathname}`);
  console.log(`wrote ${markdownOutPath.pathname}`);
}

await main();
