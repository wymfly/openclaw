import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { checkClosure } from "../../scripts/lib/openspec-closure/checker.js";
import {
  loadClosureConfig,
  resolvePlanFiles,
  resolveVerificationPath,
} from "../../scripts/lib/openspec-closure/config.js";
import {
  collectPlanCoverage,
  parsePlanCoverage,
} from "../../scripts/lib/openspec-closure/plan-coverage.js";
import { formatClosureReport } from "../../scripts/lib/openspec-closure/report.js";
import { collectScenarioInventory } from "../../scripts/lib/openspec-closure/spec-inventory.js";
import {
  createVerificationArtifact,
  readVerificationArtifact,
  writeVerificationArtifact,
} from "../../scripts/lib/openspec-closure/verification-artifact.js";
import type { VerificationArtifact } from "../../scripts/lib/openspec-closure/types.js";

const FIXTURE_ROOT = path.join(process.cwd(), "test", "fixtures", "openspec-closure");
const VALID_CHANGE = path.join(FIXTURE_ROOT, "valid-change");
const GAP_CHANGE = path.join(FIXTURE_ROOT, "gap-change");
const PROJECT_ROOT = path.join(FIXTURE_ROOT, "project-root");
const PROJECT_CHANGE = path.join(PROJECT_ROOT, "openspec", "changes", "demo-change");
const PROJECT_PLAN = path.join(PROJECT_ROOT, "docs", "plans", "demo-plan.md");
const PROJECT_VERIFICATION = path.join(PROJECT_CHANGE, "verification.yaml");
const CLOSURE_SCRIPT = path.join(process.cwd(), "scripts", "openspec-closure.ts");
const execFileAsync = promisify(execFile);

const tempDirs: string[] = [];
const DEFAULT_SPEC_BODY = `## ADDED Requirements

### Requirement: Stable IDs exist

Every active scenario SHALL expose a stable identifier.

#### Scenario: New scenario gets an id

- **scenario_id**: \`traceability.new-id\`
- **WHEN** a new scenario is added
- **THEN** it SHALL have a stable id

## MODIFIED Requirements

### Requirement: Existing IDs survive wording changes

Existing scenarios SHALL keep the same id across wording-only edits.

#### Scenario: Same scenario, new title wording

- **scenario_id**: \`traceability.same-id\`
- **WHEN** a scenario title is rewritten
- **THEN** the same id SHALL remain attached to it
`;
const DEFAULT_PLAN_BODY = `# Demo Plan

### Task 1: Cover new-id scenario

covers.id: traceability.new-id

### Task 2: Cover wording-stable scenario

**covers.id:** traceability.same-id
`;
const DEFAULT_CONFIG_BODY = `planGlobs:
  - docs/plans/*.md
blockingStatuses:
  - pending
  - blocked
  - spec-fix-required
verificationFileName: verification.yaml
`;

async function createTempChange(specBody: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "openspec-closure-"));
  tempDirs.push(tempDir);
  const specPath = path.join(tempDir, "specs", "demo-capability", "spec.md");
  await mkdir(path.dirname(specPath), { recursive: true });
  await writeFile(specPath, specBody, "utf8");
  return tempDir;
}

async function createTempProject(options?: {
  changeName?: string;
  configBody?: string;
  planBody?: string;
  specBody?: string;
  verificationArtifact?: VerificationArtifact;
  verificationFileName?: string;
}): Promise<{
  changeDir: string;
  changeName: string;
  planPath: string;
  rootDir: string;
  verificationPath: string;
}> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "openspec-closure-project-"));
  tempDirs.push(rootDir);
  const changeName = options?.changeName ?? "demo-change";
  const verificationFileName = options?.verificationFileName ?? "verification.yaml";
  const specPath = path.join(
    rootDir,
    "openspec",
    "changes",
    changeName,
    "specs",
    "scenario-traceability",
    "spec.md",
  );
  const planPath = path.join(rootDir, "docs", "plans", "demo-plan.md");
  const configPath = path.join(rootDir, ".openspec-closure.yaml");
  const verificationPath = path.join(rootDir, "openspec", "changes", changeName, verificationFileName);

  await mkdir(path.dirname(specPath), { recursive: true });
  await mkdir(path.dirname(planPath), { recursive: true });
  await writeFile(specPath, options?.specBody ?? DEFAULT_SPEC_BODY, "utf8");
  await writeFile(planPath, options?.planBody ?? DEFAULT_PLAN_BODY, "utf8");
  await writeFile(configPath, options?.configBody ?? DEFAULT_CONFIG_BODY, "utf8");

  if (options?.verificationArtifact) {
    await writeVerificationArtifact(verificationPath, options.verificationArtifact);
  }

  return {
    changeDir: path.join(rootDir, "openspec", "changes", changeName),
    changeName,
    planPath,
    rootDir,
    verificationPath,
  };
}

async function runClosureCli(args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  try {
    const result = await execFileAsync(process.execPath, ["--import", "tsx", CLOSURE_SCRIPT, ...args], {
      cwd: process.cwd(),
    });
    return {
      code: 0,
      stderr: result.stderr,
      stdout: result.stdout,
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      code?: number | string;
      stderr?: string;
      stdout?: string;
    };
    return {
      code: typeof execError.code === "number" ? execError.code : 1,
      stderr: execError.stderr ?? "",
      stdout: execError.stdout ?? "",
    };
  }
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

  it("parses machine-checkable plan coverage into scenario ownership mappings", async () => {
    const coverage = await parsePlanCoverage(PROJECT_PLAN);

    expect(
      coverage.map(({ scenarioId, taskTitle }) => ({
        scenarioId,
        taskTitle,
      })),
    ).toEqual([
      {
        scenarioId: "traceability.new-id",
        taskTitle: "Cover new-id scenario",
      },
      {
        scenarioId: "traceability.same-id",
        taskTitle: "Cover wording-stable scenario",
      },
    ]);
  });

  it("loads adapter config and resolves project-specific plan and verification paths", async () => {
    const config = await loadClosureConfig({ rootDir: PROJECT_ROOT });
    const planPaths = await resolvePlanFiles({
      rootDir: PROJECT_ROOT,
      planGlobs: config.planGlobs,
    });
    const verificationPath = resolveVerificationPath({
      changeName: "demo-change",
      rootDir: PROJECT_ROOT,
      verificationFileName: config.verificationFileName,
    });

    expect(config).toEqual({
      blockingStatuses: ["pending", "blocked", "spec-fix-required"],
      planGlobs: ["docs/plans/*.md"],
      verificationFileName: "verification.yaml",
    });
    expect(planPaths).toEqual([PROJECT_PLAN]);
    expect(verificationPath).toBe(PROJECT_VERIFICATION);
  });

  it("reports missing plan coverage and missing verification as open gaps", async () => {
    const inventory = await collectScenarioInventory(PROJECT_CHANGE);
    const result = checkClosure({
      blockingStatuses: ["pending", "blocked", "spec-fix-required"],
      changeName: "demo-change",
      coverage: [],
      inventory,
      verification: undefined,
    });

    expect(result.archiveReady).toBe(false);
    expect(result.gapCount).toBe(4);
    expect(result.gaps).toEqual([
      {
        kind: "missing-plan-coverage",
        message: "Scenario traceability.new-id is not mapped to any implementation task",
        scenarioId: "traceability.new-id",
      },
      {
        kind: "missing-verification-entry",
        message: "Scenario traceability.new-id has no verification entry",
        scenarioId: "traceability.new-id",
      },
      {
        kind: "missing-plan-coverage",
        message: "Scenario traceability.same-id is not mapped to any implementation task",
        scenarioId: "traceability.same-id",
      },
      {
        kind: "missing-verification-entry",
        message: "Scenario traceability.same-id has no verification entry",
        scenarioId: "traceability.same-id",
      },
    ]);
  });

  it("treats pending and spec-fix-required verification states as open gaps", async () => {
    const inventory = await collectScenarioInventory(PROJECT_CHANGE);
    const coverage = await collectPlanCoverage([PROJECT_PLAN]);
    const result = checkClosure({
      blockingStatuses: ["pending", "blocked", "spec-fix-required"],
      changeName: "demo-change",
      coverage,
      inventory,
      verification: {
        changeName: "demo-change",
        generatedAt: "2026-04-03T00:00:00.000Z",
        scenarios: [
          { scenarioId: "traceability.new-id", status: "pending" },
          { scenarioId: "traceability.same-id", status: "spec-fix-required" },
        ],
      },
    });

    expect(result.archiveReady).toBe(false);
    expect(result.gaps).toEqual([
      {
        kind: "open-verification-status",
        message: "Scenario traceability.new-id remains in pending state",
        scenarioId: "traceability.new-id",
      },
      {
        kind: "open-verification-status",
        message: "Scenario traceability.same-id remains in spec-fix-required state",
        scenarioId: "traceability.same-id",
      },
    ]);
  });

  it("reports archive readiness when every scenario is mapped and verified", async () => {
    const inventory = await collectScenarioInventory(PROJECT_CHANGE);
    const coverage = await collectPlanCoverage([PROJECT_PLAN]);
    const verification = await readVerificationArtifact(PROJECT_VERIFICATION);
    const result = checkClosure({
      blockingStatuses: ["pending", "blocked", "spec-fix-required"],
      changeName: "demo-change",
      coverage,
      inventory,
      verification,
    });

    expect(result).toEqual({
      archiveReady: true,
      changeName: "demo-change",
      gapCount: 0,
      gaps: [],
      scenarioCount: 2,
    });
    expect(formatClosureReport(result)).toBe(
      "Change: demo-change\nArchive Ready: yes\nScenarios: 2\nOpen Gaps: 0\n",
    );
  });

  it("initializes verification artifacts from inventory and inferred owner tasks", async () => {
    const project = await createTempProject();
    const initResult = await runClosureCli(["init", "--change", project.changeName, "--root", project.rootDir]);

    expect(initResult.code).toBe(0);
    expect(initResult.stdout.trim()).toBe(project.verificationPath);

    const artifact = await readVerificationArtifact(project.verificationPath);
    expect(artifact.scenarios).toEqual([
      {
        ownerTask: "Cover new-id scenario",
        scenarioId: "traceability.new-id",
        status: "pending",
      },
      {
        ownerTask: "Cover wording-stable scenario",
        scenarioId: "traceability.same-id",
        status: "pending",
      },
    ]);
  });

  it("returns non-zero json output for open verification gaps after init", async () => {
    const project = await createTempProject();
    await runClosureCli(["init", "--change", project.changeName, "--root", project.rootDir]);

    const checkResult = await runClosureCli([
      "check",
      "--change",
      project.changeName,
      "--root",
      project.rootDir,
      "--format",
      "json",
    ]);

    expect(checkResult.code).toBe(1);
    expect(JSON.parse(checkResult.stdout)).toEqual({
      archiveReady: false,
      changeName: "demo-change",
      gapCount: 2,
      gaps: [
        {
          kind: "open-verification-status",
          message: "Scenario traceability.new-id remains in pending state",
          scenarioId: "traceability.new-id",
        },
        {
          kind: "open-verification-status",
          message: "Scenario traceability.same-id remains in pending state",
          scenarioId: "traceability.same-id",
        },
      ],
      scenarioCount: 2,
    });
  });

  it("emits readable report output and zero-gap json results for closed fixtures", async () => {
    const checkResult = await runClosureCli([
      "check",
      "--change",
      "demo-change",
      "--root",
      PROJECT_ROOT,
      "--format",
      "json",
    ]);
    const reportResult = await runClosureCli([
      "report",
      "--change",
      "demo-change",
      "--root",
      PROJECT_ROOT,
    ]);

    expect(checkResult.code).toBe(0);
    expect(JSON.parse(checkResult.stdout)).toEqual({
      archiveReady: true,
      changeName: "demo-change",
      gapCount: 0,
      gaps: [],
      scenarioCount: 2,
    });
    expect(reportResult.code).toBe(0);
    expect(reportResult.stdout).toBe("Change: demo-change\nArchive Ready: yes\nScenarios: 2\nOpen Gaps: 0\n");
  });
});
