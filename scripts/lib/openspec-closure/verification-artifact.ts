import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import type {
  ScenarioInventoryEntry,
  VerificationArtifact,
  VerificationEntry,
  VerificationStatus,
} from "./types.js";

const ALLOWED_STATUSES: VerificationStatus[] = [
  "pending",
  "verified",
  "blocked",
  "deferred",
  "spec-fix-required",
];

function sortEntries(entries: VerificationEntry[]): VerificationEntry[] {
  return [...entries].sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));
}

export function createVerificationArtifact(params: {
  changeName: string;
  generatedAt?: string;
  inventory: ScenarioInventoryEntry[];
  defaultStatus?: VerificationStatus;
}): VerificationArtifact {
  const defaultStatus = params.defaultStatus ?? "pending";
  if (!ALLOWED_STATUSES.includes(defaultStatus)) {
    throw new Error(`Unsupported verification status: ${defaultStatus}`);
  }

  const scenarios = sortEntries(
    params.inventory.map((entry) => ({
      scenarioId: entry.scenarioId,
      status: defaultStatus,
    })),
  );

  return {
    changeName: params.changeName,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    scenarios,
  };
}

export async function readVerificationArtifact(filePath: string): Promise<VerificationArtifact> {
  const raw = await readFile(filePath, "utf8");
  const parsed = YAML.parse(raw) as VerificationArtifact | null;
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid verification artifact at ${filePath}`);
  }
  validateVerificationArtifact(parsed, filePath);
  return {
    ...parsed,
    scenarios: sortEntries(parsed.scenarios),
  };
}

export async function writeVerificationArtifact(
  filePath: string,
  artifact: VerificationArtifact,
): Promise<void> {
  validateVerificationArtifact(artifact, filePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const serialized = YAML.stringify({
    ...artifact,
    scenarios: sortEntries(artifact.scenarios),
  });
  await writeFile(filePath, serialized, "utf8");
}

function validateVerificationArtifact(artifact: VerificationArtifact, filePath: string): void {
  if (!artifact.changeName || typeof artifact.changeName !== "string") {
    throw new Error(`verification artifact ${filePath} is missing changeName`);
  }
  if (!artifact.generatedAt || typeof artifact.generatedAt !== "string") {
    throw new Error(`verification artifact ${filePath} is missing generatedAt`);
  }
  if (!Array.isArray(artifact.scenarios)) {
    throw new Error(`verification artifact ${filePath} is missing scenarios[]`);
  }
  const seen = new Set<string>();
  for (const entry of artifact.scenarios) {
    if (!entry.scenarioId || typeof entry.scenarioId !== "string") {
      throw new Error(`verification artifact ${filePath} contains an entry without scenarioId`);
    }
    if (seen.has(entry.scenarioId)) {
      throw new Error(`verification artifact ${filePath} contains duplicate scenarioId ${entry.scenarioId}`);
    }
    seen.add(entry.scenarioId);
    if (!ALLOWED_STATUSES.includes(entry.status)) {
      throw new Error(
        `verification artifact ${filePath} contains unsupported status ${String(entry.status)} for ${entry.scenarioId}`,
      );
    }
    if (entry.status === "deferred" && (!entry.rationale || typeof entry.rationale !== "string")) {
      throw new Error(
        `verification artifact ${filePath} requires rationale for deferred scenario ${entry.scenarioId}`,
      );
    }
  }
}
