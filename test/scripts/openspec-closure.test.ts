import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { collectScenarioInventory } from "../../scripts/lib/openspec-closure/spec-inventory.js";
import {
  createVerificationArtifact,
  readVerificationArtifact,
  writeVerificationArtifact,
} from "../../scripts/lib/openspec-closure/verification-artifact.js";

const FIXTURE_ROOT = path.join(process.cwd(), "test", "fixtures", "openspec-closure");
const VALID_CHANGE = path.join(FIXTURE_ROOT, "valid-change");
const GAP_CHANGE = path.join(FIXTURE_ROOT, "gap-change");

const tempDirs: string[] = [];

async function createTempChange(specBody: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "openspec-closure-"));
  tempDirs.push(tempDir);
  const specPath = path.join(tempDir, "specs", "demo-capability", "spec.md");
  await mkdir(path.dirname(specPath), { recursive: true });
  await writeFile(specPath, specBody, "utf8");
  return tempDir;
}

describe("openspec closure primitives", () => {
  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  });

  it("collects active ADDED/MODIFIED scenarios with stable ids", async () => {
    const inventory = await collectScenarioInventory(VALID_CHANGE);
    expect(inventory).toEqual([
      {
        capability: "scenario-traceability",
        changeName: "valid-change",
        requirementTitle: "Stable IDs exist",
        scenarioId: "traceability.new-id",
        scenarioTitle: "New scenario gets an id",
        section: "ADDED",
        specPath: "specs/scenario-traceability/spec.md",
      },
      {
        capability: "scenario-traceability",
        changeName: "valid-change",
        requirementTitle: "Existing IDs survive wording changes",
        scenarioId: "traceability.same-id",
        scenarioTitle: "Same scenario, new title wording",
        section: "MODIFIED",
        specPath: "specs/scenario-traceability/spec.md",
      },
    ]);
  });

  it("treats wording-only scenario title edits as the same logical id", async () => {
    const original = await createTempChange(`## ADDED Requirements

### Requirement: Stable IDs exist

#### Scenario: Original title

- **scenario_id**: \`traceability.same-id\`
- **WHEN** a title changes
- **THEN** the scenario keeps the same identity
`);
    const rewritten = await createTempChange(`## ADDED Requirements

### Requirement: Stable IDs exist

#### Scenario: Rewritten title for the same scenario

- **scenario_id**: \`traceability.same-id\`
- **WHEN** a title changes
- **THEN** the scenario keeps the same identity
`);

    const originalInventory = await collectScenarioInventory(original);
    const rewrittenInventory = await collectScenarioInventory(rewritten);

    expect(originalInventory).toHaveLength(1);
    expect(rewrittenInventory).toHaveLength(1);
    expect(originalInventory[0]?.scenarioId).toBe("traceability.same-id");
    expect(rewrittenInventory[0]?.scenarioId).toBe("traceability.same-id");
    expect(originalInventory[0]?.scenarioTitle).not.toBe(rewrittenInventory[0]?.scenarioTitle);
  });

  it("fails when an active scenario omits scenario_id", async () => {
    await expect(collectScenarioInventory(GAP_CHANGE)).rejects.toThrow(
      /Missing scenario_id .*Scenario is missing its id/u,
    );
  });

  it("initializes verification entries for every active scenario", async () => {
    const inventory = await collectScenarioInventory(VALID_CHANGE);
    const artifact = createVerificationArtifact({
      changeName: "valid-change",
      generatedAt: "2026-04-03T00:00:00.000Z",
      inventory,
    });

    expect(artifact).toEqual({
      changeName: "valid-change",
      generatedAt: "2026-04-03T00:00:00.000Z",
      scenarios: [
        { scenarioId: "traceability.new-id", status: "pending" },
        { scenarioId: "traceability.same-id", status: "pending" },
      ],
    });
  });

  it("writes and reads verification artifacts with owner, command, and evidence intact", async () => {
    const filePath = path.join(await mkdtemp(path.join(os.tmpdir(), "openspec-verification-")), "verification.yaml");
    tempDirs.push(path.dirname(filePath));

    await writeVerificationArtifact(filePath, {
      changeName: "valid-change",
      generatedAt: "2026-04-03T00:00:00.000Z",
      scenarios: [
        {
          scenarioId: "traceability.new-id",
          ownerTask: "Task 1",
          verificationCommand: "pnpm test -- test/scripts/openspec-closure.test.ts",
          evidence: ["test/scripts/openspec-closure.test.ts"],
          status: "verified",
        },
      ],
    });

    const raw = await readFile(filePath, "utf8");
    expect(raw).toContain("scenarioId: traceability.new-id");
    expect(raw).toContain("ownerTask: Task 1");

    const artifact = await readVerificationArtifact(filePath);
    expect(artifact).toEqual({
      changeName: "valid-change",
      generatedAt: "2026-04-03T00:00:00.000Z",
      scenarios: [
        {
          scenarioId: "traceability.new-id",
          ownerTask: "Task 1",
          verificationCommand: "pnpm test -- test/scripts/openspec-closure.test.ts",
          evidence: ["test/scripts/openspec-closure.test.ts"],
          status: "verified",
        },
      ],
    });
  });
});
