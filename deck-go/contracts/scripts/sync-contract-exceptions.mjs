import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const sourcePath = new URL("source/deck-exceptions.contract.json", root);
const docPath = new URL("../docs/deck-contract-exceptions.md", root);

function renderMarkdown(contract) {
  const lines = [
    "# Deck Contract Exceptions",
    "",
    "Generated from `deck-go/contracts/source/deck-exceptions.contract.json`.",
    "",
    "| ID | Kind | Method / Surface | Owner | Reason | Exit criteria |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  for (const exception of contract.exceptions ?? []) {
    lines.push(
      `| \`${exception.id}\` | \`${exception.kind}\` | \`${exception.method ?? exception.surface ?? ""}\` | ${exception.owner} | ${exception.reason} | ${exception.exitCriteria} |`,
    );
  }

  if (!contract.exceptions?.length) {
    lines.push("| n/a | n/a | n/a | n/a | n/a | n/a |");
  }

  lines.push("");
  return lines.join("\n");
}

function validate(contract) {
  const ids = new Set();
  for (const exception of contract.exceptions ?? []) {
    for (const field of ["id", "kind", "owner", "reason", "exitCriteria"]) {
      if (!exception[field]?.trim()) {
        throw new Error(`exception ${exception.id ?? "<missing-id>"} missing ${field}`);
      }
    }
    if (!exception.method && !exception.surface) {
      throw new Error(`exception ${exception.id} must define method or surface`);
    }
    if (ids.has(exception.id)) {
      throw new Error(`duplicate exception id: ${exception.id}`);
    }
    ids.add(exception.id);
  }
}

async function main() {
  const contract = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  validate(contract);
  const expected = renderMarkdown(contract);

  if (process.env.CHECK_MODE === "1") {
    const actual = await fs.readFile(docPath, "utf8");
    if (actual !== expected) {
      console.error(
        "deck-contract-exceptions.md is stale. Run: node contracts/scripts/sync-contract-exceptions.mjs",
      );
      process.exit(1);
    }
    console.log("contract exceptions are up to date");
    return;
  }

  await fs.writeFile(docPath, expected, "utf8");
  console.log(`wrote ${docPath.pathname}`);
}

await main();
