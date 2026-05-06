import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  assertRunScopedCleanupTarget,
  buildRealE2EFixtureName,
  deferredRealE2EFixtureClasses,
  filterRunScopedResources,
  prepareIsolatedOpenClawState,
  redactSecrets,
  realE2EEvidenceStatuses,
  unsafeRealE2EFixtureClasses,
  writeRealE2EEvidence,
  writeRealE2EScenarioEvidence,
} from "./helpers";

test.describe("real E2E foundation helpers", () => {
  test("copies OpenClaw config into an isolated root and rewrites agent workspaces", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "deck-go-foundation-e2e-"));
    try {
      const sourceState = path.join(root, "source-state");
      const sourceWorkspace = path.join(root, "source-workspace");
      const sourceAgentWorkspace = path.join(root, "source-agent-workspace");
      await mkdir(sourceState, { recursive: true });
      await mkdir(sourceWorkspace, { recursive: true });
      await mkdir(sourceAgentWorkspace, { recursive: true });
      await writeFile(path.join(sourceWorkspace, "AGENTS.md"), "source default workspace\n");
      await writeFile(path.join(sourceAgentWorkspace, "AGENTS.md"), "source main workspace\n");

      const sourceConfigPath = path.join(sourceState, "openclaw.json");
      const sourceConfig = {
        agents: {
          defaults: {
            model: "cpa/gpt-5.4",
            repoRoot: sourceWorkspace,
            workspace: sourceWorkspace,
          },
          list: [
            {
              id: "main",
              default: true,
              name: "Main",
              runtime: { type: "acp", acp: { cwd: sourceAgentWorkspace } },
              workspace: sourceAgentWorkspace,
            },
          ],
        },
        channels: {
          "openclaw-weixin": {
            dmPolicy: "pairing",
          },
        },
        providers: {
          cpa: {
            apiKey: "real-key-that-must-not-appear-in-evidence",
          },
        },
        plugins: {
          entries: {
            "openclaw-weixin": {
              enabled: true,
            },
          },
        },
      };
      await writeFile(sourceConfigPath, `${JSON.stringify(sourceConfig, null, 2)}\n`);

      const isolation = await prepareIsolatedOpenClawState({
        root,
        dataDir: path.join(root, "data"),
        logDir: path.join(root, "logs"),
        runId: "deckgo-e2e-test-run",
        sourceConfigPath,
      });

      const copied = JSON.parse(await readFile(isolation.configPath, "utf8")) as {
        agents?: {
          defaults?: { repoRoot?: string; workspace?: string };
          list?: Array<{ runtime?: { acp?: { cwd?: string } }; workspace?: string }>;
        };
      };
      expect(copied.agents?.defaults?.workspace).toContain(isolation.workspaceRoot);
      expect(copied.agents?.defaults?.repoRoot).toContain(isolation.workspaceRoot);
      expect(copied.agents?.list?.[0]?.workspace).toContain(isolation.workspaceRoot);
      expect(copied.agents?.list?.[0]?.runtime?.acp?.cwd).toContain(isolation.workspaceRoot);
      expect(copied.agents?.list?.[0]?.workspace).not.toBe(sourceAgentWorkspace);
      expect((copied as { channels?: unknown }).channels).toBeUndefined();
      expect(
        (copied as { plugins?: { entries?: Record<string, unknown> } }).plugins?.entries?.[
          "openclaw-weixin"
        ],
      ).toBeUndefined();
      expect(isolation.sanitizedConfig?.removedChannels).toEqual(["openclaw-weixin"]);
      expect(isolation.sanitizedConfig?.removedPluginEntries).toEqual(["openclaw-weixin"]);
      await expect(
        readFile(path.join(isolation.workspaceRoot, "main", "AGENTS.md"), "utf8"),
      ).resolves.toContain("source main workspace");

      const original = JSON.parse(await readFile(sourceConfigPath, "utf8")) as typeof sourceConfig;
      expect(original.agents.defaults.workspace).toBe(sourceWorkspace);
      expect(original.agents.list[0]?.workspace).toBe(sourceAgentWorkspace);

      const persistentEvidenceDir = path.join(root, "persistent-evidence");
      const previousEvidenceDir = process.env.DECK_GO_REAL_E2E_EVIDENCE_DIR;
      process.env.DECK_GO_REAL_E2E_EVIDENCE_DIR = persistentEvidenceDir;
      try {
        const evidencePath = await writeRealE2EEvidence({ realE2E: isolation }, "redaction-check", {
          apiKey: "real-key-that-must-not-appear-in-evidence",
          authorization: "Bearer secret-token",
          nested: { token: "hidden-token", value: "visible" },
        });
        const evidence = await readFile(evidencePath, "utf8");
        expect(evidence).not.toContain("real-key-that-must-not-appear-in-evidence");
        expect(evidence).not.toContain("secret-token");
        expect(evidence).not.toContain("hidden-token");
        expect(evidence).toContain("visible");

        const persistentEvidence = await readFile(
          path.join(persistentEvidenceDir, "deckgo-e2e-test-run-redaction-check.json"),
          "utf8",
        );
        expect(persistentEvidence).toBe(evidence);

        const scenarioEvidencePath = await writeRealE2EScenarioEvidence(
          { realE2E: isolation },
          "scenario-check",
          {
            attempts: [{ ok: false }],
            maxAttempts: 2,
            reason: "skipped by helper test",
            runId: isolation.runId,
            scenarioId: "real-e2e.helper-scenario",
            status: "skipped-safe",
          },
        );
        const scenarioEvidence = JSON.parse(await readFile(scenarioEvidencePath, "utf8")) as Record<
          string,
          unknown
        >;
        expect(scenarioEvidence.attemptCount).toBe(1);
        expect(scenarioEvidence.status).toBe("skipped-safe");
        await expect(
          writeRealE2EScenarioEvidence({ realE2E: isolation }, "invalid-status", {
            runId: isolation.runId,
            scenarioId: "real-e2e.invalid-status",
            status: "unknown",
          }),
        ).rejects.toThrow(/invalid status/);
        await expect(
          writeRealE2EScenarioEvidence({ realE2E: isolation }, "too-many-attempts", {
            attempts: [{ ok: false }, { ok: false }],
            maxAttempts: 1,
            runId: isolation.runId,
            scenarioId: "real-e2e.too-many-attempts",
            status: "handoff-blocked",
          }),
        ).rejects.toThrow(/over max/);
      } finally {
        if (previousEvidenceDir === undefined) {
          delete process.env.DECK_GO_REAL_E2E_EVIDENCE_DIR;
        } else {
          process.env.DECK_GO_REAL_E2E_EVIDENCE_DIR = previousEvidenceDir;
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("keeps disposable cleanup constrained to the current run id", () => {
    const runId = "deckgo-e2e-run-123";
    const resources = [
      { id: `${runId}-budget`, name: "Budget" },
      { id: "operator-budget", name: "Budget" },
      { id: "webhook-1", metadata: { deckGoE2ERunId: runId } },
    ];

    expect(filterRunScopedResources(resources, runId)).toHaveLength(2);
    expect(() => assertRunScopedCleanupTarget(resources[0], runId)).not.toThrow();
    expect(() => assertRunScopedCleanupTarget(resources[1], runId)).toThrow(/refusing to clean up/);
    expect(buildRealE2EFixtureName({ realE2E: { runId } as never }, "budget")).toBe(
      `${runId}-budget`,
    );
    expect(realE2EEvidenceStatuses).toEqual([
      "passed",
      "degraded",
      "empty-valid",
      "skipped-safe",
      "handoff-blocked",
    ]);
    expect(unsafeRealE2EFixtureClasses).toContain("device tokens");
    expect(deferredRealE2EFixtureClasses).toContain("routing bindings");
    expect(redactSecrets({ password: "p", safe: "ok" })).toEqual({
      password: "***redacted***",
      safe: "ok",
    });
  });
});
