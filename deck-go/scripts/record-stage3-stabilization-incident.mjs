import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultLedgerPath = path.join(rootDir, "docs", "stage3-stabilization-window.json");
const allowedSeverities = new Set(["sev1", "sev2", "sev3", "sev4", "info"]);

function fail(message) {
  console.error(`[stage3-stabilization] record failed: ${message}`);
  process.exit(1);
}

function readFlagValue(flag, required = false) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    if (required) {
      fail(`missing required ${flag}`);
    }
    return null;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`missing value for ${flag}`);
  }
  return value;
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const ledgerPath = path.resolve(readFlagValue("--file") ?? defaultLedgerPath);
const date = readFlagValue("--date", true);
const severity = String(readFlagValue("--severity", true)).toLowerCase();
const summary = readFlagValue("--summary", true);
const attribution = readFlagValue("--attribution");
const status = readFlagValue("--status");

if (!isIsoDate(date)) {
  fail("--date must use YYYY-MM-DD format");
}
if (!allowedSeverities.has(severity)) {
  fail(`--severity must be one of ${Array.from(allowedSeverities).join(", ")}`);
}
if (summary.trim() === "") {
  fail("--summary must be non-empty");
}

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
if (
  !ledger ||
  typeof ledger !== "object" ||
  Array.isArray(ledger) ||
  !Array.isArray(ledger.incidents)
) {
  fail("ledger must be a valid stabilization window object with an incidents array");
}

const incident = {
  date,
  severity,
  summary,
  ...(attribution ? { attribution } : {}),
  ...(status ? { status } : {}),
};

ledger.incidents.push(incident);
ledger.incidents.sort((left, right) => {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }
  return left.summary.localeCompare(right.summary);
});

fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

console.log(
  `[stage3-stabilization] recorded ${severity.toUpperCase()} incident in ${path.relative(rootDir, ledgerPath) || path.basename(ledgerPath)}: ${summary}`,
);
