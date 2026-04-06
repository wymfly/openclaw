// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverviewTab } from "./OverviewTab";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/stores/deck-agents", () => ({
  useDeckAgentsStore: () => ({
    agentIdentity: null,
    fetchIdentity: vi.fn(),
  }),
}));

vi.mock("./ChannelEventStreamSection", () => ({
  ChannelEventStreamSection: () => <div data-testid="event-streams" />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("OverviewTab", () => {
  it("renders reasoning/fast defaults and sandbox backend/ssh details when present", () => {
    render(
      <OverviewTab
        detail={{
          id: "main",
          workspace: "/tmp/main",
          isDefault: true,
          bindingCount: 1,
          sessionCount: 2,
          activeSubagentCount: 0,
          skillMode: "all",
          effectiveSkills: [],
          totalAvailableSkills: 0,
          subagents: {
            allowAgents: [],
            effectiveMaxSpawnDepth: 1,
            effectiveMaxChildrenPerAgent: 5,
          },
          identityExists: false,
          model: "gpt-5.4",
          reasoningDefault: "stream",
          fastModeDefault: true,
          sandbox: {
            mode: "workspace-write",
            elevation: "elevated",
            filesystem: "restricted",
            backend: "docker",
            ssh: { host: "remote-box" },
          },
        }}
        onNavigateTab={vi.fn()}
      />,
    );

    expect(screen.getByText("config.reasoningDefault: config.reasoning_stream")).toBeTruthy();
    expect(screen.getByText("config.fastModeDefault: config.enabled")).toBeTruthy();
    expect(screen.getByText("sandboxBackend")).toBeTruthy();
    expect(screen.getByText("docker")).toBeTruthy();
    expect(screen.getByText("sandboxSsh")).toBeTruthy();
    expect(screen.getByText("configured")).toBeTruthy();
  });
});
