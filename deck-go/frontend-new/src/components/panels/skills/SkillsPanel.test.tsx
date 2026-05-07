// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { SkillsPanel } from "./SkillsPanel";

const apiMocks = vi.hoisted(() => ({
  fetchPluginApprovals: vi.fn(),
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
  navigateToPlugin: vi.fn(),
  ui: { setActivePanel: vi.fn() },
}));

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToAgent: deckUIMocks.navigateToAgent,
  navigateToPanel: (_ui: unknown, panel: string) => deckUIMocks.ui.setActivePanel(panel),
  navigateToPlugin: deckUIMocks.navigateToPlugin,
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
    skills: [
      {
        key: "shell",
        name: "Shell",
        source: "bundled",
        sourceRaw: "openclaw-bundled",
        status: "ready",
        description: "Run shell commands",
        enabled: true,
        apiKeyConfigured: false,
        agentUsage: { count: 1, agentIds: ["main"] },
        availableActions: ["disable", "updateApiKey", "updateEnv"],
        unsupportedReasons: {
          uninstall: "gateway-rpc-missing",
          rotate: "gateway-rpc-missing",
          apiKeyHint: "gateway-safe-secret-summary-missing",
        },
        primaryEnv: "PATH",
        owningPlugin: null,
      },
      {
        key: "github",
        name: "GitHub",
        source: "managed",
        sourceRaw: "openclaw-managed",
        status: "needs-setup",
        description: "Manage pull requests",
        enabled: true,
        apiKeyConfigured: true,
        agentUsage: { count: 2, agentIds: ["main", "ops"] },
        availableActions: [
          "disable",
          "updateApiKey",
          "clearApiKey",
          "updateEnv",
          "runInstallRecipe",
          "updateAllClawHub",
        ],
        unsupportedReasons: {
          uninstall: "gateway-rpc-missing",
          rotate: "gateway-rpc-missing",
          perSkillUpgrade: "gateway-tracking-status-missing",
          apiKeyHint: "gateway-safe-secret-summary-missing",
        },
        missingRequirements: ["env: GITHUB_TOKEN", "bins: gh"],
        primaryEnv: "GITHUB_TOKEN",
        config: { env: { GITHUB_TOKEN: "old-token" } },
        installOptions: [{ id: "brew-gh", label: "Install gh", bins: ["gh"] }],
        owningPlugin: { id: "git-plugin", name: "Git Plugin" },
      },
      {
        key: "workspace",
        name: "Workspace Skill",
        source: "workspace",
        sourceRaw: "openclaw-workspace",
        status: "disabled",
        enabled: false,
        apiKeyConfigured: false,
        agentUsage: { count: 0, agentIds: [] },
        availableActions: ["enable", "updateApiKey", "updateEnv"],
        unsupportedReasons: {
          uninstall: "gateway-rpc-missing",
          rotate: "gateway-rpc-missing",
          apiKeyHint: "gateway-safe-secret-summary-missing",
        },
        owningPlugin: null,
      },
    ],
  };
}

async function renderReady(locale: "en" | "zh" = "en") {
  await act(async () => {
    renderSkillsPanel(locale);
  });
  await waitFor(() => expect(apiMocks.fetchSkills).toHaveBeenCalledTimes(1));
}

function clickText(text: string | RegExp) {
  const button = screen.getByRole("button", { name: text });
  act(() => {
    fireEvent.click(button);
  });
  return button;
}

function changeField(label: string, value: string) {
  act(() => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });
}

describe("SkillsPanel product control plane", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchSkills.mockResolvedValue(skillsPayload());
    apiMocks.fetchPluginApprovals.mockResolvedValue({
      entries: [
        { id: "plugin-ap-1", status: "pending" },
        { id: "plugin-ap-2", status: "pending" },
      ],
    });
    apiMocks.searchSkillHub.mockResolvedValue({
      results: [{ slug: "git-helper", displayName: "Git Helper", version: "1.0.0" }],
    });
    apiMocks.fetchSkillHubDetail.mockResolvedValue({
      skill: { slug: "git-helper", displayName: "Git Helper", summary: "Git workflows" },
      latestVersion: { version: "1.0.0" },
    });
    apiMocks.installSkill.mockResolvedValue({ ok: true, code: 0, stdout: "", stderr: "" });
    apiMocks.installSkillHub.mockResolvedValue({ ok: true, slug: "git-helper" });
    apiMocks.updateSkill.mockResolvedValue({ ok: true });
    apiMocks.updateSkillHub.mockResolvedValue({ ok: true });
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

  it("renders list workbench plus fixed detail sections instead of the old tab model", async () => {
    await renderReady();

    expect(screen.getByRole("heading", { name: "Skills" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Install from ClawHub" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approvals: 2 pending" })).toBeTruthy();
    expect(screen.getByText("managed")).toBeTruthy();

    clickText("GitHub");

    for (const section of [
      "Identity",
      "Source & activation",
      "API key",
      "env",
      "Eligibility health",
      "Agent Usage",
      "Owning Plugin",
      "Danger zone",
    ]) {
      expect(screen.getByRole("heading", { name: section })).toBeTruthy();
    }
    expect(screen.queryByRole("tab", { name: "Setup" })).toBeNull();
    expect(screen.queryByText("Triggers")).toBeNull();
  });

  it("keeps Agent Usage read-only and routes edits to Agents", async () => {
    await renderReady();
    clickText("GitHub");

    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("ops")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add GitHub|Remove GitHub|Save skills/i })).toBeNull();

    clickText("Open main in Agents");
    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(deckUIMocks.ui, "main", "skills");
    expect(apiMocks.updateAgentSkills).not.toHaveBeenCalled();
  });

  it("masks apiKey state and validates env keys before save", async () => {
    await renderReady();
    clickText("GitHub");

    expect(screen.getByText("API key configured")).toBeTruthy();
    expect(container.textContent).not.toContain("old-token");

    clickText("Update API key");
    const secretInput = screen.getByLabelText("New API key") as HTMLInputElement;
    expect(secretInput.type).toBe("password");
    changeField("New API key", "new-secret-token");
    expect(container.textContent).not.toContain("new-secret-token");
    clickText("Save API key");
    await waitFor(() => expect(apiMocks.updateSkill).toHaveBeenCalledWith("github", { apiKey: "new-secret-token" }));

    clickText("Edit env");
    changeField("Env key 1", "bad-key");
    expect(screen.getByText("Keys must match ^[A-Z][A-Z0-9_]*$")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save env" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("runs global ClawHub update-all with no slug or version", async () => {
    await renderReady();

    clickText("Update all managed");
    expect(screen.getByText("This updates all tracked ClawHub skills in this Gateway workspace.")).toBeTruthy();
    clickText("Confirm update all");

    await waitFor(() => expect(apiMocks.updateSkillHub).toHaveBeenCalledWith());
  });

  it("installs through the wizard and treats post-install setup failure as recoverable", async () => {
    apiMocks.updateSkill.mockRejectedValueOnce(new Error("post install update failed"));
    await renderReady();

    clickText("Install from ClawHub");
    clickText("Next: slug");
    changeField("Skill slug", "git-helper");
    clickText("Preview slug");
    await waitFor(() => expect(apiMocks.fetchSkillHubDetail).toHaveBeenCalledWith("git-helper"));
    clickText("Next: API key");
    changeField("Optional install API key", "__deck_test_apikey_run_1");
    clickText("Next: env");
    changeField("Wizard env key 1", "GIT_TOKEN");
    changeField("Wizard env value 1", "1");
    clickText("Review install");

    expect(container.textContent).toContain("installSkillHub first, then updateSkill for setup");
    expect(container.textContent).not.toContain("__deck_test_apikey_run_1");
    clickText("Confirm install");

    await waitFor(() => expect(apiMocks.installSkillHub).toHaveBeenCalledWith("git-helper"));
    await waitFor(() =>
      expect(apiMocks.updateSkill).toHaveBeenCalledWith("git-helper", {
        apiKey: "__deck_test_apikey_run_1",
        env: { GIT_TOKEN: "1" },
      }),
    );
    expect(screen.getByText("Install succeeded. API key or env setup failed; retry from the detail sections.")).toBeTruthy();
  });

  it("preserves per-bin install recipe behavior in AddBinDialog", async () => {
    await renderReady();
    clickText("GitHub");
    clickText("Run install recipe");
    clickText("Install gh");

    await waitFor(() => expect(apiMocks.installSkill).toHaveBeenCalledWith("GitHub", "brew-gh"));
  });

  it("does not import or call updateAgentSkills from Skills components", async () => {
    await renderReady();
    clickText("GitHub");

    const skillsDir = join(process.cwd(), "src/components/panels/skills");
    const source = readdirSync(skillsDir)
      .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
      .map((file) => readFileSync(join(skillsDir, file), "utf8"))
      .join("\n");
    expect(source).not.toContain("updateAgentSkills");
    expect(apiMocks.updateAgentSkills).not.toHaveBeenCalled();
  });

  it("supports Chinese rendering without losing core section labels", async () => {
    await renderReady("zh");
    clickText("GitHub");

    expect(screen.getByRole("heading", { name: "身份" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "危险区" })).toBeTruthy();
  });
});
