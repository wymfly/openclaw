import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

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

describe("openspec closure plugin distribution", () => {
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

    expect(wrapperSource).toContain("openspec-closure-core");
    expect(wrapperSource).not.toContain("scripts/lib/openspec-closure");
    expect(wrapperSource).not.toContain("../scripts/openspec-closure.ts");
  });
});
