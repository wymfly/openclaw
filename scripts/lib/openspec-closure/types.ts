export type ScenarioSection = "ADDED" | "MODIFIED";

export type VerificationStatus =
  | "pending"
  | "verified"
  | "blocked"
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
