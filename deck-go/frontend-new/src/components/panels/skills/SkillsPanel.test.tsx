// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { SkillsPanel } from "./SkillsPanel";

const apiMocks = vi.hoisted(() => ({
  fetchAgentSkills: vi.fn(),
  fetchAgentsList: vi.fn(),
  fetchSkillHubBins: vi.fn(),
  fetchSkillHubDetail: vi.fn(),
  fetchSkills: vi.fn(),
  installSkill: vi.fn(),
  installSkillHub: vi.fn(),
  searchSkillHub: vi.fn(),
  updateAgentSkills: vi.fn(),
  updateSkill: vi.fn(),
  updateSkillHub: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToAgent: vi.fn(),
  ui: { setActivePanel: vi.fn() },
}));

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToAgent: deckUIMocks.navigateToAgent,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));

let container: HTMLDivElement;
let root: Root | null = null;

function renderSkillsPanel(locale: "en" | "zh" = "en") {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale }, createElement(SkillsPanel)));
}

function skillsPayload() {
  return {
    managedSkillsDir: "/tmp/openclaw-skills",
    skills: [
      {
        key: "shell",
        name: "Shell",
        source: "bundled",
        status: "ready",
        description: "Run shell commands",
        enabled: true,
        primaryEnv: "PATH",
      },
      {
        key: "github",
        name: "GitHub",
        source: "plugin",
        status: "needs-setup",
        description: "Manage pull requests",
        enabled: true,
        missingRequirements: ["env: GITHUB_TOKEN", "bins: gh"],
        primaryEnv: "GITHUB_TOKEN",
        config: { apiKey: "old-token", env: { GITHUB_TOKEN: "old-token" } },
        installOptions: [{ id: "brew-gh", label: "Install gh", bins: ["gh"] }],
      },
      {
        key: "design",
        name: "Frontend Design",
        source: "managed",
        status: "ready",
        description: "Create design prototypes",
        enabled: true,
      },
      {
        key: "legacy",
        name: "Legacy",
        source: "plugin",
        status: "disabled",
        description: "Disabled legacy helper",
        enabled: false,
      },
    ],
  };
}

describe("SkillsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchAgentsList.mockResolvedValue({
      agents: [
        { id: "main", name: "Main Agent" },
        { id: "builder", name: "Builder Agent" },
      ],
    });
    apiMocks.fetchAgentSkills.mockImplementation((agentId: string) =>
      Promise.resolve(
        agentId === "builder"
          ? {
              agentId: "builder",
              mode: "whitelist",
              skills: ["shell"],
              available: [
                { key: "shell", name: "Shell", eligible: true, assigned: true },
                { key: "github", name: "GitHub", eligible: true, assigned: false },
              ],
              configHash: "skills-builder-1",
            }
          : {
              agentId: "main",
              mode: "all",
              skills: ["shell", "github"],
              available: [
                { key: "shell", name: "Shell", eligible: true, assigned: true },
                { key: "github", name: "GitHub", eligible: true, assigned: true },
              ],
              configHash: "skills-main-1",
            },
      ),
    );
    apiMocks.fetchSkillHubBins.mockResolvedValue({ bins: ["dev", "ops"] });
    apiMocks.fetchSkillHubDetail.mockResolvedValue({
      skill: {
        slug: "git-helper",
        displayName: "Git Helper",
        summary: "Manage git workflows",
        updatedAt: 1710000000000,
      },
      latestVersion: { version: "1.0.0", changelog: "Initial release" },
      metadata: { os: ["darwin", "linux"], systems: ["git"] },
      owner: { handle: "clawhub", displayName: "ClawHub" },
    });
    apiMocks.fetchSkills.mockResolvedValue(skillsPayload());
    apiMocks.installSkill.mockResolvedValue({ ok: true, installed: "github" });
    apiMocks.installSkillHub.mockResolvedValue({ ok: true, installed: "git-helper" });
    apiMocks.searchSkillHub.mockResolvedValue({
      results: [
        {
          slug: "git-helper",
          displayName: "Git Helper",
          summary: "Manage git workflows",
          version: "1.0.0",
          score: 0.98,
          updatedAt: 1710000000000,
        },
      ],
    });
    apiMocks.updateSkill.mockResolvedValue({ ok: true, config: { enabled: false } });
    apiMocks.updateAgentSkills.mockResolvedValue({
      ok: true,
      agentId: "builder",
      mode: "whitelist",
      skills: ["github", "shell"],
      configHash: "skills-builder-2",
    });
    apiMocks.updateSkillHub.mockResolvedValue({ ok: true, updated: true });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.clearAllMocks();
  });

  it("renders the prototype-shaped installed catalog by default", async () => {
    await act(async () => {
      renderSkillsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));

    expect(container.querySelector(".skills-panel__page-header")).toBeTruthy();
    expect(container.querySelector(".skills-panel__kpi-strip")).toBeTruthy();
    expect(container.querySelector(".skills-panel__toolbar")).toBeTruthy();
    expect(container.querySelector(".skills-panel__row-head")).toBeTruthy();
    expect(container.querySelector(".skills-panel__row")).toBeTruthy();
    expect(container.textContent).toContain("skill catalog");
    expect(container.textContent).toContain("Installed");
    expect(container.textContent).toContain("4");
    expect(container.textContent).toContain("GitHub");
    expect(container.textContent).toContain("GITHUB_TOKEN");
    expect(container.textContent).toContain("Frontend Design");
  });

  it("filters installed skills by search, status, and source", async () => {
    await act(async () => {
      renderSkillsPanel();
    });
    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));

    const search = container.querySelector<HTMLInputElement>('input[aria-label="Search skills"]');
    expect(search).toBeTruthy();

    await act(async () => {
      fireEvent.change(search as HTMLInputElement, { target: { value: "pull requests" } });
    });
    expect(container.textContent).toContain("GitHub");
    expect(container.textContent).not.toContain("ShellRun shell commands");

    await act(async () => {
      fireEvent.click(buttonWithText("Needs setup"));
    });
    expect(container.textContent).toContain("GitHub");
    expect(container.textContent).not.toContain("Frontend Design");

    await act(async () => {
      fireEvent.click(buttonWithText("Managed"));
    });
    expect(container.textContent).toContain("No installed skills match filters.");
  });

  it("opens detail tabs and runs configure, install, and disable through wrappers", async () => {
    await act(async () => {
      renderSkillsPanel();
    });
    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));

    await act(async () => {
      fireEvent.click(buttonWithText("GitHub"));
    });
    expect(container.textContent).toContain("Identity");

    for (const tab of ["Setup", "Triggers", "Bins", "Files", "Audit", "Overview"]) {
      await act(async () => {
        fireEvent.click(tabButtonWithText(tab));
      });
      expect(tabButtonWithText(tab).getAttribute("aria-selected")).toBe("true");
    }

    await act(async () => {
      fireEvent.click(buttonWithText("Configure"));
    });
    expect(container.textContent).toContain("Configure skill");
    const apiKeyInput = container.querySelector<HTMLInputElement>('input[type="password"]');
    const envTextarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="skill env json"]',
    );
    expect(apiKeyInput?.value).toBe("old-token");
    expect(envTextarea?.value).toContain("GITHUB_TOKEN");

    await act(async () => {
      fireEvent.change(apiKeyInput as HTMLInputElement, { target: { value: "new-token" } });
      fireEvent.change(envTextarea as HTMLTextAreaElement, {
        target: { value: JSON.stringify({ GITHUB_TOKEN: "new-token", EXTRA: 42 }, null, 2) },
      });
      fireEvent.click(buttonWithText("Save config"));
    });
    await waitFor(() =>
      expect(apiMocks.updateSkill).toHaveBeenLastCalledWith("github", {
        apiKey: "new-token",
        env: { GITHUB_TOKEN: "new-token", EXTRA: "42" },
      }),
    );

    await act(async () => {
      fireEvent.click(buttonWithText("Install"));
    });
    await act(async () => {
      fireEvent.click(buttonWithText("Install gh"));
    });
    await waitFor(() => expect(apiMocks.installSkill).toHaveBeenCalledWith("GitHub", "brew-gh"));

    await act(async () => {
      fireEvent.click(buttonWithText("Disable"));
    });
    await act(async () => {
      fireEvent.click(lastButtonWithText("Disable"));
    });
    await waitFor(() =>
      expect(apiMocks.updateSkill).toHaveBeenLastCalledWith("github", { enabled: false }),
    );
  });

  it("searches hub, opens hub detail dialog, installs, and updates all through BFF wrappers", async () => {
    await act(async () => {
      renderSkillsPanel();
    });
    await waitFor(() => expect(apiMocks.fetchSkillHubBins).toHaveBeenCalledTimes(1));

    await act(async () => {
      fireEvent.click(buttonWithText("Hub"));
    });
    const search = container.querySelector<HTMLInputElement>('input[aria-label="Search skills"]');
    await act(async () => {
      fireEvent.change(search as HTMLInputElement, { target: { value: "git" } });
      fireEvent.click(buttonWithText("Search hub"));
    });
    await waitFor(() => expect(apiMocks.searchSkillHub).toHaveBeenCalledWith("git", 20));
    expect(container.textContent).toContain("Git Helper");

    await act(async () => {
      fireEvent.click(buttonWithText("Preview"));
    });
    await waitFor(() => expect(apiMocks.fetchSkillHubDetail).toHaveBeenCalledWith("git-helper"));
    expect(container.textContent).toContain("Install skill from hub");

    await act(async () => {
      fireEvent.click(buttonWithText("Install from ClawHub"));
    });
    await waitFor(() =>
      expect(apiMocks.installSkillHub).toHaveBeenCalledWith("git-helper", "1.0.0"),
    );

    await act(async () => {
      fireEvent.click(buttonWithText("Hub"));
      fireEvent.click(buttonWithText("Update all ClawHub"));
    });
    await waitFor(() => expect(apiMocks.updateSkillHub).toHaveBeenCalledWith());
  });

  it("keeps the agent skill matrix reachable as a secondary detail surface", async () => {
    await act(async () => {
      renderSkillsPanel();
    });
    await waitFor(() => expect(apiMocks.fetchAgentsList).toHaveBeenCalledTimes(1));

    await act(async () => {
      fireEvent.click(buttonWithText("GitHub"));
    });
    await act(async () => {
      const summary = container.querySelector("summary");
      if (!summary) {
        throw new Error("matrix summary not found");
      }
      fireEvent.click(summary);
    });
    expect(container.textContent).toContain("Main Agent");
    expect(container.textContent).toContain("Builder Agent");

    await act(async () => {
      fireEvent.click(buttonWithText("Builder Agent"));
    });
    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(deckUIMocks.ui, "builder", "skills");

    const addGitHubToBuilder = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add github for builder"]',
    );
    expect(addGitHubToBuilder).toBeTruthy();
    await act(async () => {
      addGitHubToBuilder?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() =>
      expect(apiMocks.updateAgentSkills).toHaveBeenCalledWith("builder", {
        mode: "whitelist",
        skills: ["github", "shell"],
        baseHash: "skills-builder-1",
      }),
    );
  });

  it("renders localized Chinese catalog chrome", async () => {
    await act(async () => {
      renderSkillsPanel("zh");
    });
    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));

    expect(container.textContent).toContain("技能管理");
    expect(container.textContent).toContain("控制 / 技能目录");
    expect(container.textContent).toContain("已安装");
    expect(container.textContent).toContain("市场");
  });
});

function buttonWithText(text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!button) {
    throw new Error(`button not found: ${text}\n${container.textContent}`);
  }
  return button;
}

function lastButtonWithText(text: string) {
  const buttons = Array.from(container.querySelectorAll("button")).filter((candidate) =>
    candidate.textContent?.includes(text),
  );
  const button = buttons.at(-1);
  if (!button) {
    throw new Error(`button not found: ${text}\n${container.textContent}`);
  }
  return button;
}

function tabButtonWithText(text: string) {
  const button = Array.from(container.querySelectorAll('button[role="tab"]')).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!button) {
    throw new Error(`tab not found: ${text}\n${container.textContent}`);
  }
  return button;
}
