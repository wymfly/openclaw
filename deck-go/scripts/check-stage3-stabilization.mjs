import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = path.join(rootDir, "docs", "stage3-stabilization-window.json");
const enforce = process.argv.includes("--enforce");

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const windowStart = new Date(`${ledger.windowStart}T00:00:00Z`);
const passAt = new Date(windowStart);
passAt.setUTCDate(passAt.getUTCDate() + ledger.windowDays);
const today = new Date();
const todayIso = today.toISOString().slice(0, 10);

const incidents = Array.isArray(ledger.incidents) ? ledger.incidents : [];
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
  process.exit(1);
}
