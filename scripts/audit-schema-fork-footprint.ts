#!/usr/bin/env -S node --import tsx
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaFiles = [
  "src/gateway/protocol/schema/sessions.ts",
  "src/gateway/protocol/schema/nodes.ts",
  "src/gateway/protocol/schema/protocol-schemas.ts",
  "src/gateway/protocol/schema/agents-models-skills.ts",
  "src/gateway/protocol/schema/devices.ts",
  "src/gateway/protocol/schema/cron.ts",
  "src/gateway/protocol/schema/logs-chat.ts",
  "src/gateway/protocol/schema/config.ts",
  "src/gateway/protocol/schema/exec-approvals.ts",
  "src/gateway/protocol/index.ts",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    base: process.env.BASE ?? "",
    maxLines: Number(process.env.MAX_SCHEMA_FORK_LINES ?? 5),
    enforce: false,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--base") {
      options.base = args[++index] ?? "";
    } else if (arg === "--max-lines") {
      options.maxLines = Number(args[++index] ?? "5");
    } else if (arg === "--enforce") {
      options.enforce = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help") {
      console.log(
        "Usage: node --import tsx scripts/audit-schema-fork-footprint.ts [--base <sha>] [--max-lines <n>] [--enforce] [--json]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function resolveBase(explicitBase) {
  if (explicitBase) {
    return explicitBase;
  }
  const candidates = [
    ["merge-base", "upstream/main", "enhanced"],
    ["merge-base", "origin/main", "HEAD"],
    ["merge-base", "main", "HEAD"],
  ];
  for (const candidate of candidates) {
    try {
      const result = git(candidate);
      if (result) {
        return result;
      }
    } catch {
      // Try the next local ref combination.
    }
  }
  throw new Error("Unable to resolve base. Pass --base <sha> or set BASE=<sha>.");
}

function countChangedLines(base, file) {
  if (!existsSync(path.join(repoRoot, file))) {
    return { file, added: 0, deleted: 0, total: 0, exists: false };
  }
  const diff = git(["diff", "--numstat", base, "--", file]);
  if (!diff) {
    return { file, added: 0, deleted: 0, total: 0, exists: true };
  }
  const [addedRaw = "0", deletedRaw = "0"] = diff.split(/\s+/);
  const added = Number(addedRaw === "-" ? 0 : addedRaw);
  const deleted = Number(deletedRaw === "-" ? 0 : deletedRaw);
  return { file, added, deleted, total: Math.max(added, deleted), exists: true };
}

const options = parseArgs();
const base = resolveBase(options.base);
const rows = schemaFiles.map((file) => countChangedLines(base, file));
const violations = rows.filter((row) => row.total > options.maxLines);

if (options.json) {
  console.log(
    JSON.stringify(
      { base, maxLines: options.maxLines, enforce: options.enforce, rows, violations },
      null,
      2,
    ),
  );
} else {
  console.log(
    `schema fork footprint base=${base} maxLines=${options.maxLines} enforce=${options.enforce}`,
  );
  for (const row of rows) {
    const status = row.total > options.maxLines ? "FAIL" : "OK";
    console.log(`${status}\t${row.total}\t+${row.added}/-${row.deleted}\t${row.file}`);
  }
}

if (options.enforce && violations.length > 0) {
  process.exitCode = 1;
}
