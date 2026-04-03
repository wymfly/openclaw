import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const CODEX_PLUGIN_ROOT = path.join(process.cwd(), "plugins", "openspec-closure");
const CODEX_MANIFEST = path.join(CODEX_PLUGIN_ROOT, ".codex-plugin", "plugin.json");
const CODEX_SKILL = path.join(
  CODEX_PLUGIN_ROOT,
  "skills",
  "openspec-closure-workflow",
  "SKILL.md",
);
const CODEX_WRAPPER = path.join(CODEX_PLUGIN_ROOT, "scripts", "openspec-closure.ts");
const CLAUDE_PLUGIN_ROOT = path.join(process.cwd(), "plugins", "openspec-closure-claude");
const CLAUDE_MANIFEST = path.join(CLAUDE_PLUGIN_ROOT, ".claude-plugin", "plugin.json");
const CLAUDE_SKILL = path.join(
  CLAUDE_PLUGIN_ROOT,
  "skills",
  "openspec-closure-workflow",
  "SKILL.md",
);
const CLAUDE_WRAPPER = path.join(CLAUDE_PLUGIN_ROOT, "scripts", "openspec-closure.ts");
const MINIMAL_PROJECT_ROOT = path.join(
  process.cwd(),
  "test",
  "fixtures",
  "openspec-closure-plugin",
  "minimal-project",
);
const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

async function runPluginWrapper(wrapperPath: string, args: string[], cwd = process.cwd()) {
  try {
    const result = await execFileAsync(process.execPath, ["--import", "tsx", wrapperPath, ...args], {
      cwd,
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

async function createProjectWithoutAdapter(): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "openspec-closure-plugin-"));
  tempDirs.push(rootDir);
  const specPath = path.join(
    rootDir,
    "openspec",
    "changes",
    "demo-change",
    "specs",
    "scenario-traceability",
    "spec.md",
  );
  const planPath = path.join(rootDir, "docs", "plans", "demo-plan.md");
  await mkdir(path.dirname(specPath), { recursive: true });
  await mkdir(path.dirname(planPath), { recursive: true });
  await writeFile(
    specPath,
    `## ADDED Requirements

### Requirement: Stable IDs exist

#### Scenario: New scenario gets an id

- **scenario_id**: \`traceability.new-id\`
- **WHEN** a new scenario is added
- **THEN** it SHALL have a stable id
`,
    "utf8",
  );
  await writeFile(
    planPath,
    `# Demo Plan

### Task 1: Cover new-id scenario

covers.id: traceability.new-id
`,
    "utf8",
  );
  return rootDir;
}

describe("openspec closure plugin distribution", () => {
  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  });

  it("codex bundle declares the closure workflow plugin manifest", async () => {
    const manifest = JSON.parse(await readFile(CODEX_MANIFEST, "utf8")) as {
      interface?: { category?: string; displayName?: string };
      name: string;
      skills?: string;
      version?: string;
    };

    expect(manifest.name).toBe("openspec-closure");
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.version).toBe("0.0.0");
    expect(manifest.interface?.displayName).toBe("OpenSpec Closure");
    expect(manifest.interface?.category).toBe("Developer Tools");
  });

  it("codex bundle routes closure execution through plugin-local wrapper assets", async () => {
    const skillSource = await readFile(CODEX_SKILL, "utf8");
    const wrapperSource = await readFile(CODEX_WRAPPER, "utf8");

    expect(skillSource).toContain("openspec-closure-workflow");
    expect(skillSource).toContain("init");
    expect(skillSource).toContain("report");
    expect(skillSource).toContain("check");
    expect(skillSource).toContain("must not redefine closure rules themselves");

    expect(wrapperSource).toContain("openspec-closure-core");
    expect(wrapperSource).not.toContain("scripts/lib/openspec-closure");
    expect(wrapperSource).not.toContain("../scripts/openspec-closure.ts");
  });

  it("declares a package script for the codex bundle smoke test", async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["openspec:closure:plugin:test"]).toBe(
      "pnpm test -- test/scripts/openspec-closure-plugin.test.ts",
    );
  });

  it("claude bundle mirrors the closure workflow manifest contract", async () => {
    const manifest = JSON.parse(await readFile(CLAUDE_MANIFEST, "utf8")) as {
      description?: string;
      name: string;
      version?: string;
    };

    expect(manifest.name).toBe("openspec-closure");
    expect(manifest.version).toBe("0.0.0");
    expect(manifest.description).toContain("closure");
  });

  it("claude bundle exposes the same workflow lifecycle through bundled assets", async () => {
    const skillSource = await readFile(CLAUDE_SKILL, "utf8");
    const wrapperSource = await readFile(CLAUDE_WRAPPER, "utf8");

    expect(skillSource).toContain("openspec-closure-workflow");
    expect(skillSource).toContain("init");
    expect(skillSource).toContain("report");
    expect(skillSource).toContain("check");
    expect(skillSource).toContain("must not redefine closure rules themselves");

    expect(wrapperSource).toContain("openspec-closure-core");
    expect(wrapperSource).not.toContain("scripts/lib/openspec-closure");
    expect(wrapperSource).not.toContain("../scripts/openspec-closure.ts");
  });

  it("minimal project uses the codex bundle wrapper without repo-local checker sources", async () => {
    const reportResult = await runPluginWrapper(
      CODEX_WRAPPER,
      ["report", "--change", "demo-change", "--root", MINIMAL_PROJECT_ROOT],
      MINIMAL_PROJECT_ROOT,
    );
    const checkResult = await runPluginWrapper(
      CODEX_WRAPPER,
      ["check", "--change", "demo-change", "--root", MINIMAL_PROJECT_ROOT, "--format", "json"],
      MINIMAL_PROJECT_ROOT,
    );

    expect(reportResult.code).toBe(0);
    expect(reportResult.stdout).toContain("Change: demo-change");
    expect(reportResult.stdout).toContain("Archive Ready: yes");
    expect(checkResult.code).toBe(0);
    expect(JSON.parse(checkResult.stdout)).toMatchObject({
      archiveReady: true,
      changeName: "demo-change",
      gapCount: 0,
    });
  });

  it("missing adapter emits bootstrap guidance instead of a raw ENOENT", async () => {
    const projectRoot = await createProjectWithoutAdapter();
    const result = await runPluginWrapper(
      CODEX_WRAPPER,
      ["report", "--change", "demo-change", "--root", projectRoot],
      process.cwd(),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(".openspec-closure.yaml");
    expect(result.stderr).toContain("covers.id");
    expect(result.stderr).toContain("verification.yaml");
    expect(result.stderr).not.toContain("ENOENT");
  });
});
