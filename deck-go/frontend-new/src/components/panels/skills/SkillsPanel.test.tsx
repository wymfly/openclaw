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

function renderSkillsPanel() {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale: "en" }, createElement(SkillsPanel)));
}

function skillsPayload() {
  return {
    skills: [
      {
        key: "shell",
        name: "Shell",
        source: "bundled",
        description: "Run shell commands",
        emoji: "$",
        primaryEnv: "PATH",
        disabled: false,
      },
      {
        skillKey: "github",
        name: "GitHub",
        source: "plugin",
        missing: ["GITHUB_TOKEN"],
        primaryEnv: "GITHUB_TOKEN",
        config: { apiKey: "old-token", env: { GITHUB_TOKEN: "old-token" } },
        install: [{ id: "brew-gh", label: "Install gh", bins: ["gh"] }],
        disabled: false,
      },
      {
        key: "legacy",
        name: "Legacy",
        source: "unknown",
        disabled: true,
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
      metadata: { os: ["darwin", "linux"] },
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

  it("normalizes raw skills and selects the first skill by default", async () => {
    await act(async () => {
      renderSkillsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(container.querySelector(".deck-ui-skills-table-shell")).toBeTruthy(),
    );

    expect(container.querySelector(".deck-ui-skills")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-card")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-body")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-status-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-actions")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-input")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-button")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-list")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-hero")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-surface")).toBeTruthy();
    expect(container.querySelector(".deck-ui-skills-textarea")).toBeTruthy();
    expect(container.textContent).toContain("Skills ready");
    expect(container.textContent).toContain("3 installed");
    expect(container.textContent).toContain("1 need setup");
    expect(container.textContent).toContain("Shell");
    expect(container.textContent).toContain("GitHub");
    expect(container.textContent).toContain("Legacy");
    expect(container.textContent).toContain("Source: plugin | Status: needs-setup");
    expect(container.textContent).toContain("Source: bundled | Status: disabled");

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Shell");
  });

  it("filters installed skills by status and search text", async () => {
    await act(async () => {
      renderSkillsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="installed skill search"]',
    );
    const statusSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="installed skill status"]',
    );
    expect(searchInput).toBeTruthy();
    expect(statusSelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(statusSelect as HTMLSelectElement, { target: { value: "needs-setup" } });
    });

    let installedList = container.querySelector('ul[aria-label="installed skill list"]');
    expect(installedList?.textContent).toContain("GitHub");
    expect(installedList?.textContent).not.toContain("Shell");
    expect(installedList?.textContent).not.toContain("Legacy");
    expect(container.textContent).toContain("shown1");

    await act(async () => {
      fireEvent.change(statusSelect as HTMLSelectElement, { target: { value: "all" } });
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "run shell" } });
    });

    installedList = container.querySelector('ul[aria-label="installed skill list"]');
    expect(installedList?.textContent).toContain("Shell");
    expect(installedList?.textContent).not.toContain("GitHub");

    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "missing skill" } });
    });

    expect(container.textContent).toContain("No installed skills match filters.");
  });

  it("runs enable and disable updates and preserves the selected skill", async () => {
    await act(async () => {
      renderSkillsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("GitHub"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Disable")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateSkill).toHaveBeenCalledWith("github", { enabled: false }),
    );
    expect(container.textContent).toContain("Last skill action");

    const selectedAfterDisable = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedAfterDisable?.textContent).toContain("GitHub");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Legacy"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Enable")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateSkill).toHaveBeenLastCalledWith("legacy", { enabled: true }),
    );
  });

  it("saves selected skill config and runs install options through the skill facade", async () => {
    await act(async () => {
      renderSkillsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("GitHub"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const apiKeyInput = container.querySelector<HTMLInputElement>('input[type="password"]');
    const envTextarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="skill env json"]',
    );
    expect(apiKeyInput).toBeTruthy();
    expect(envTextarea).toBeTruthy();
    expect(apiKeyInput?.value).toBe("old-token");
    expect(envTextarea?.value).toContain("GITHUB_TOKEN");

    await act(async () => {
      fireEvent.change(apiKeyInput as HTMLInputElement, { target: { value: "new-token" } });
      fireEvent.change(envTextarea as HTMLTextAreaElement, {
        target: { value: JSON.stringify({ GITHUB_TOKEN: "new-token", EXTRA: 42 }, null, 2) },
      });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save config")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateSkill).toHaveBeenLastCalledWith("github", {
        apiKey: "new-token",
        env: { GITHUB_TOKEN: "new-token", EXTRA: "42" },
      }),
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Install")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.installSkill).toHaveBeenCalledWith("GitHub", "brew-gh"));
    expect(container.textContent).toContain("Last skill action");
  });

  it("searches ClawHub and runs hub install/update actions through the hub facade", async () => {
    await act(async () => {
      renderSkillsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiMocks.fetchSkillHubBins).toHaveBeenCalledTimes(1));
    expect(container.textContent).toContain("dev");

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="skill hub search"]',
    );
    expect(searchInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "git" } });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Search hub")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.searchSkillHub).toHaveBeenCalledWith("git", 20));
    expect(container.textContent).toContain("Git Helper");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Git Helper"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchSkillHubDetail).toHaveBeenCalledWith("git-helper"));
    expect(container.textContent).toContain("Version: 1.0.0");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Install from ClawHub")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.installSkillHub).toHaveBeenCalledWith("git-helper", "1.0.0"),
    );
    expect(container.textContent).toContain("Last hub action");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Update all ClawHub")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.updateSkillHub).toHaveBeenCalledWith());
  });

  it("loads and updates the agent skill matrix with Gateway config hashes", async () => {
    await act(async () => {
      renderSkillsPanel();
    });

    await waitFor(() => expect(apiMocks.fetchAgentsList).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiMocks.fetchAgentSkills).toHaveBeenCalledWith("builder"));

    expect(container.textContent).toContain("Agent skill matrix");
    expect(container.textContent).toContain("Main Agent");
    expect(container.textContent).toContain("Builder Agent");
    expect(container.textContent).toContain("all skills");
    expect(container.textContent).toContain("included");
    expect(container.textContent).toContain("excluded");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Builder Agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
    expect(container.textContent).toContain("Last matrix action");
  });
});
