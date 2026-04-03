import type {
  ClosureCheckResult,
  ClosureGap,
  PlanCoverageEntry,
  ScenarioInventoryEntry,
  VerificationArtifact,
  VerificationStatus,
} from "./types.js";

export function checkClosure(params: {
  blockingStatuses: VerificationStatus[];
  changeName: string;
  coverage: PlanCoverageEntry[];
  inventory: ScenarioInventoryEntry[];
  verification?: VerificationArtifact;
}): ClosureCheckResult {
  const coverageIds = new Set(params.coverage.map((entry) => entry.scenarioId));
  const verificationEntries = new Map(
    (params.verification?.scenarios ?? []).map((entry) => [entry.scenarioId, entry]),
  );
  const blocking = new Set(params.blockingStatuses);
  const gaps: ClosureGap[] = [];

  for (const scenario of params.inventory) {
    if (!coverageIds.has(scenario.scenarioId)) {
      gaps.push({
        kind: "missing-plan-coverage",
        message: `Scenario ${scenario.scenarioId} is not mapped to any implementation task`,
        scenarioId: scenario.scenarioId,
      });
    }

    const verificationEntry = verificationEntries.get(scenario.scenarioId);
    if (!verificationEntry) {
      gaps.push({
        kind: "missing-verification-entry",
        message: `Scenario ${scenario.scenarioId} has no verification entry`,
        scenarioId: scenario.scenarioId,
      });
      continue;
    }

    if (blocking.has(verificationEntry.status)) {
      gaps.push({
        kind: "open-verification-status",
        message: `Scenario ${scenario.scenarioId} remains in ${verificationEntry.status} state`,
        scenarioId: scenario.scenarioId,
      });
    }
  }

  return {
    archiveReady: gaps.length === 0,
    changeName: params.changeName,
    gapCount: gaps.length,
    gaps,
    scenarioCount: params.inventory.length,
  };
}
