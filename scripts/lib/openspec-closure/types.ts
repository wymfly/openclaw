export type ScenarioSection = "ADDED" | "MODIFIED";

export type VerificationStatus =
  | "pending"
  | "verified"
  | "blocked"
  | "deferred"
  | "spec-fix-required";

export type ScenarioInventoryEntry = {
  capability: string;
  changeName: string;
  requirementTitle: string;
  scenarioId: string;
  scenarioTitle: string;
  section: ScenarioSection;
  specPath: string;
};

export type VerificationEntry = {
  scenarioId: string;
  ownerTask?: string;
  verificationCommand?: string;
  evidence?: string[];
  rationale?: string;
  status: VerificationStatus;
};

export type VerificationArtifact = {
  changeName: string;
  generatedAt: string;
  scenarios: VerificationEntry[];
};

export type PlanCoverageEntry = {
  planPath: string;
  scenarioId: string;
  taskTitle: string;
};

export type ClosureGapKind =
  | "missing-plan-coverage"
  | "missing-verification-entry"
  | "open-verification-status";

export type ClosureGap = {
  kind: ClosureGapKind;
  message: string;
  scenarioId: string;
};

export type ClosureCheckResult = {
  archiveReady: boolean;
  changeName: string;
  gapCount: number;
  gaps: ClosureGap[];
  scenarioCount: number;
};

export type ClosureProjectConfig = {
  blockingStatuses: VerificationStatus[];
  planGlobs: string[];
  verificationFileName: string;
};
