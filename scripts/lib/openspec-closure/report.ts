import type { ClosureCheckResult } from "./types.js";

export function formatClosureReport(result: ClosureCheckResult): string {
  const lines = [
    `Change: ${result.changeName}`,
    `Archive Ready: ${result.archiveReady ? "yes" : "no"}`,
    `Scenarios: ${result.scenarioCount}`,
    `Open Gaps: ${result.gapCount}`,
  ];

  if (result.gapCount > 0) {
    lines.push("");
    lines.push("Gaps:");
    for (const gap of result.gaps) {
      lines.push(`- [${gap.kind}] ${gap.scenarioId}: ${gap.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
