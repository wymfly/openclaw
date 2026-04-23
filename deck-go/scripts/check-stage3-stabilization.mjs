import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultLedgerPath = path.join(rootDir, "docs", "stage3-stabilization-window.json");

function fail(message) {
  console.error(`[stage3-stabilization] invalid ledger: ${message}`);
  process.exit(1);
}

function readFlagValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
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

function asDayStart(value, fieldName) {
  if (!isIsoDate(value)) {
    fail(`${fieldName} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    fail(`${fieldName} must be a valid calendar date`);
  }
  return date;
}

const ledgerPath = path.resolve(readFlagValue("--file") ?? defaultLedgerPath);
const enforce = process.argv.includes("--enforce");

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) {
  fail("top-level JSON must be an object");
}
if (typeof ledger.program !== "string" || ledger.program.trim() === "") {
  fail("program must be a non-empty string");
}
const windowStart = asDayStart(ledger.windowStart, "windowStart");
if (!Number.isInteger(ledger.windowDays) || ledger.windowDays <= 0) {
  fail("windowDays must be a positive integer");
}
if (!Array.isArray(ledger.supportedEnvironments) || ledger.supportedEnvironments.length === 0) {
  fail("supportedEnvironments must be a non-empty array");
}
for (const environment of ledger.supportedEnvironments) {
  if (typeof environment !== "string" || environment.trim() === "") {
    fail("supportedEnvironments entries must be non-empty strings");
  }
}
if (!ledger.openedBy || typeof ledger.openedBy !== "object" || Array.isArray(ledger.openedBy)) {
  fail("openedBy must be an object");
}
if (typeof ledger.openedBy.commit !== "string" || ledger.openedBy.commit.trim() === "") {
  fail("openedBy.commit must be a non-empty string");
}
if (!Array.isArray(ledger.openedBy.evidence) || ledger.openedBy.evidence.length === 0) {
  fail("openedBy.evidence must be a non-empty array");
}
for (const command of ledger.openedBy.evidence) {
  if (typeof command !== "string" || command.trim() === "") {
    fail("openedBy.evidence entries must be non-empty strings");
  }
}

const passAt = new Date(windowStart);
passAt.setUTCDate(passAt.getUTCDate() + ledger.windowDays);
const today = new Date();
const todayIso = today.toISOString().slice(0, 10);

if (!Array.isArray(ledger.incidents)) {
  fail("incidents must be an array");
}

const allowedSeverities = new Set(["sev1", "sev2", "sev3", "sev4", "info"]);
const incidents = ledger.incidents;
let previousDate = "";
for (const [index, incident] of incidents.entries()) {
  if (!incident || typeof incident !== "object" || Array.isArray(incident)) {
    fail(`incidents[${index}] must be an object`);
  }
  if (!isIsoDate(incident.date)) {
    fail(`incidents[${index}].date must use YYYY-MM-DD format`);
  }
  if (incident.date < previousDate) {
    fail(`incidents[${index}].date must be sorted in ascending order`);
  }
  previousDate = incident.date;
  const severity = String(incident.severity ?? "").toLowerCase();
  if (!allowedSeverities.has(severity)) {
    fail(`incidents[${index}].severity must be one of ${Array.from(allowedSeverities).join(", ")}`);
  }
  if (typeof incident.summary !== "string" || incident.summary.trim() === "") {
    fail(`incidents[${index}].summary must be a non-empty string`);
  }
  if ("attribution" in incident && typeof incident.attribution !== "string") {
    fail(`incidents[${index}].attribution must be a string when present`);
  }
  if ("status" in incident && typeof incident.status !== "string") {
    fail(`incidents[${index}].status must be a string when present`);
  }
}

const blockingIncidents = incidents.filter((incident) => {
  const severity = String(incident.severity ?? "").toLowerCase();
  return severity === "sev1" || severity === "sev2";
});

const remainingMs = passAt.getTime() - today.getTime();
const remainingDays = Math.max(0, Math.ceil(remainingMs / 86_400_000));
const passedByTime = today >= passAt;
const passes = passedByTime && blockingIncidents.length === 0;

const summaryLines = [
  `[stage3-stabilization] program: ${ledger.program}`,
  `[stage3-stabilization] ledger: ${path.relative(rootDir, ledgerPath) || path.basename(ledgerPath)}`,
  `[stage3-stabilization] opened: ${ledger.windowStart}`,
  `[stage3-stabilization] earliest-pass-date: ${passAt.toISOString().slice(0, 10)}`,
  `[stage3-stabilization] today: ${todayIso}`,
  `[stage3-stabilization] incidents logged: ${incidents.length}`,
  `[stage3-stabilization] blocking incidents: ${blockingIncidents.length}`,
];

if (!passedByTime) {
  summaryLines.push(`[stage3-stabilization] status: pending (${remainingDays} day(s) remaining)`);
} else if (blockingIncidents.length > 0) {
  summaryLines.push("[stage3-stabilization] status: failed (Sev-1/Sev-2 regression recorded)");
} else {
  summaryLines.push("[stage3-stabilization] status: passed");
}

if (enforce) {
  summaryLines.push(`[stage3-stabilization] enforce: ${passes ? "pass" : "fail"}`);
}

console.log(summaryLines.join("\n"));

if (blockingIncidents.length > 0) {
  console.log("[stage3-stabilization] blocking incident summaries:");
  for (const incident of blockingIncidents) {
    console.log(
      `- ${incident.date ?? "unknown-date"} ${String(incident.severity).toUpperCase()}: ${incident.summary ?? "no summary"}`,
    );
  }
}

if (enforce && !passes) {
  if (!passedByTime) {
    console.error(
      `[stage3-stabilization] enforce failed: stabilization window has not elapsed; earliest pass date is ${passAt.toISOString().slice(0, 10)}`,
    );
  } else if (blockingIncidents.length > 0) {
    console.error(
      "[stage3-stabilization] enforce failed: Sev-1/Sev-2 regression recorded in ledger",
    );
  }
  process.exit(1);
}
