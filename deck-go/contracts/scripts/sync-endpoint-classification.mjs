import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const sourcePath = new URL("source/deck-endpoints.contract.json", root);
const docPath = new URL("../docs/fe-endpoint-classification.md", root);

const defaultCategories = {
  "deck-go-bff": "Deck Go control-plane or shaping routes that remain BFF REST endpoints.",
  "documented-exception":
    "temporary or intentionally dynamic routes that stay outside generated DTO adoption and must point to an exception record.",
  "gateway-protocol-adapter":
    "Deck Go routes or retired route rows that adapt an OpenClaw Gateway method or event through generated protocol bindings when available.",
  "stream-binary-upload":
    "binary asset, iframe, upload, download, or SSE transport endpoints that stay outside JSON DTO typing.",
};

const legacyCategoryAliases = {
  "binary-stream-upload": "stream-binary-upload",
  "gateway-rpc-proxy": "gateway-protocol-adapter",
};

function normalizeCategory(category) {
  return legacyCategoryAliases[category] ?? category;
}

function splitCells(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function unquoteCell(cell) {
  const exactCode = cell.match(/^`([^`]*)`$/);
  return exactCode ? exactCode[1] : cell;
}

function parseExistingDoc(markdown) {
  const endpoints = [];
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("| `")) {
      continue;
    }
    const cells = splitCells(line);
    if (cells.length < 4 || cells[0] === "---") {
      continue;
    }
    const paths = [...cells[0].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    endpoints.push({
      category: normalizeCategory(unquoteCell(cells[1])),
      migrationTarget: unquoteCell(cells[2]),
      notes: cells[3],
      paths,
    });
  }
  return {
    categories: defaultCategories,
    sourceAudited: "deck-go/frontend/src/api.ts",
    endpoints,
  };
}

function renderMarkdown(contract) {
  const categories = contract.categories ?? defaultCategories;
  const lines = [
    "# Deck Go FE Endpoint Classification",
    "",
    `Source audited: \`${contract.sourceAudited ?? "deck-go/frontend/src/api.ts"}\``,
    "",
    "Categories:",
    "",
  ];

  for (const [category, description] of Object.entries(categories).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`- \`${category}\`: ${description}`);
  }

  lines.push("", "| Path | Category | Migration Target | Notes |", "| --- | --- | --- | --- |");

  for (const endpoint of contract.endpoints ?? []) {
    const paths = endpoint.paths.map((entry) => `\`${entry}\``).join(", ");
    lines.push(
      `| ${paths} | \`${endpoint.category}\` | ${endpoint.migrationTarget} | ${endpoint.notes} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

async function main() {
  if (process.argv.includes("--init-from-doc")) {
    const markdown = await fs.readFile(docPath, "utf8");
    const contract = parseExistingDoc(markdown);
    await fs.writeFile(sourcePath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
    console.log(`wrote ${sourcePath.pathname}`);
    return;
  }

  const contract = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  const expected = renderMarkdown(contract);

  if (process.env.CHECK_MODE === "1") {
    const actual = await fs.readFile(docPath, "utf8");
    if (actual !== expected) {
      console.error(
        "fe-endpoint-classification.md is stale. Run: node contracts/scripts/sync-endpoint-classification.mjs",
      );
      process.exit(1);
    }
    console.log("endpoint classification is up to date");
    return;
  }

  await fs.writeFile(docPath, expected, "utf8");
  console.log(`wrote ${docPath.pathname}`);
}

await main();
