#!/usr/bin/env -S node --import tsx
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultAllowedFields = new Set([
  "forkClass",
  "forkDeprecated",
  "forkDeprecationReplacement",
  "forkDeprecationSince",
  "forkDeprecationRemovalTarget",
  "bffEligible",
  "controlPlaneWrite",
  "schemaVersion",
]);
const defaultAllowedMethods = new Set(["gateway.batch"]);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    baseline: ".omc/research/describe-baseline.json",
    current: ".omc/research/describe-current.json",
    allowField: new Set(defaultAllowedFields),
    allowMethod: new Set(defaultAllowedMethods),
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--baseline") {
      options.baseline = args[++index] ?? options.baseline;
    } else if (arg === "--current") {
      options.current = args[++index] ?? options.current;
    } else if (arg === "--allow-field") {
      options.allowField.add(args[++index] ?? "");
    } else if (arg === "--allow-method") {
      options.allowMethod.add(args[++index] ?? "");
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help") {
      console.log(
        "Usage: node --import tsx scripts/diff-describe-baseline.ts [--baseline <file>] [--current <file>] [--allow-field <field>] [--allow-method <method>] [--json]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function readJson(repoPath) {
  return JSON.parse(readFileSync(path.join(repoRoot, repoPath), "utf8"));
}

function escapePointerSegment(segment) {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function diffJson(left, right, pointer = "") {
  if (Object.is(left, right)) {
    return [];
  }
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object" ||
    Array.isArray(left) !== Array.isArray(right)
  ) {
    return [{ path: pointer || "/", kind: "changed", before: left, after: right }];
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const diffs = [];
  for (const key of [...keys].toSorted((a, b) => a.localeCompare(b))) {
    const childPointer = `${pointer}/${escapePointerSegment(key)}`;
    if (!(key in left)) {
      diffs.push({ path: childPointer, kind: "added", after: right[key] });
    } else if (!(key in right)) {
      diffs.push({ path: childPointer, kind: "removed", before: left[key] });
    } else {
      diffs.push(...diffJson(left[key], right[key], childPointer));
    }
  }
  return diffs;
}

function unescapePointerSegment(segment) {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function isAllowed(diff, options) {
  const segments = diff.path.split("/").slice(1).map(unescapePointerSegment);
  const last = segments.at(-1);
  if (last && options.allowField.has(last)) {
    return true;
  }
  if (segments.length >= 2 && segments[0] === "methods") {
    const method = segments[1];
    if (options.allowMethod.has(method)) {
      return true;
    }
  }
  return false;
}

const options = parseArgs();
const diffs = diffJson(readJson(options.baseline), readJson(options.current));
const disallowed = diffs.filter((diff) => !isAllowed(diff, options));
const result = {
  baseline: options.baseline,
  current: options.current,
  diffCount: diffs.length,
  allowedCount: diffs.length - disallowed.length,
  disallowed,
};

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`describe diff count=${diffs.length} disallowed=${disallowed.length}`);
  for (const diff of disallowed) {
    console.error(`FAIL\t${diff.kind}\t${diff.path}`);
  }
}

if (disallowed.length > 0) {
  process.exitCode = 1;
}
