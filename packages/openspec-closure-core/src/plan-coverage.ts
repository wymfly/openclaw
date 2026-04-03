import { readFile } from "node:fs/promises";

import type { PlanCoverageEntry } from "./types.js";

const TASK_PATTERN = /^### Task(?: \d+)?: (.+)$/;
const COVERS_ID_PATTERNS = [
  /^covers\.id:\s*`?([^`\r\n]+)`?\s*$/i,
  /^\*\*covers\.id:\*\*\s*`?([^`\r\n]+)`?\s*$/i,
];

export async function collectPlanCoverage(planPaths: string[]): Promise<PlanCoverageEntry[]> {
  const coverage = await Promise.all(planPaths.map(async (planPath) => parsePlanCoverage(planPath)));
  return coverage.flat().sort((left, right) => {
    const pathOrder = left.planPath.localeCompare(right.planPath);
    if (pathOrder !== 0) {
      return pathOrder;
    }
    const taskOrder = left.taskTitle.localeCompare(right.taskTitle);
    if (taskOrder !== 0) {
      return taskOrder;
    }
    return left.scenarioId.localeCompare(right.scenarioId);
  });
}

export async function parsePlanCoverage(planPath: string): Promise<PlanCoverageEntry[]> {
  const raw = await readFile(planPath, "utf8");
  const lines = raw.split(/\r?\n/u);
  let currentTaskTitle: string | null = null;
  const entries: PlanCoverageEntry[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const taskMatch = line.match(TASK_PATTERN);
    if (taskMatch) {
      currentTaskTitle = taskMatch[1]?.trim() ?? null;
      continue;
    }
    for (const pattern of COVERS_ID_PATTERNS) {
      const match = line.match(pattern);
      const scenarioId = match?.[1]?.trim();
      if (!scenarioId) {
        continue;
      }
      if (!currentTaskTitle) {
        throw new Error(`covers.id ${scenarioId} in ${planPath} appears before any Task heading`);
      }
      entries.push({
        planPath,
        scenarioId,
        taskTitle: currentTaskTitle,
      });
      break;
    }
  }

  return entries;
}
