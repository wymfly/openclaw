// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionsStore } from "@/stores/sessions";
import { SessionDetail } from "../SessionDetail";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = ((key: string) => key) as ((key: string) => string) & {
      has: (key: string) => boolean;
    };
    t.has = () => false;
    return t;
  },
}));

vi.mock("@/components/lists", () => ({
  InlineEdit: ({ value, placeholder }: { value?: string; placeholder?: string }) => (
    <span>{value || placeholder}</span>
  ),
}));

vi.mock("@/components/shared/LineageTree", () => ({
  LineageTree: () => <div data-testid="lineage-tree" />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/panels/sessions/SessionExport", () => ({
  SessionExport: () => <div data-testid="session-export" />,
}));

vi.mock("@/components/panels/sessions/TranscriptSearch", () => ({
  TranscriptSearch: () => <div data-testid="transcript-search" />,
}));

vi.mock("@/stores/deck-subagents", () => ({
  useDeckSubagentsStore: () => ({
    lineage: [],
    fetchLineage: vi.fn(),
  }),
}));

vi.mock("@/lib/panel-navigation", () => ({
  navigateToSession: vi.fn(),
  navigateToSubagents: vi.fn(),
}));

describe("SessionDetail", () => {
  beforeEach(() => {
    useSessionsStore.setState((state) => ({
      ...state,
      sessions: [
        {
          key: "sess-1",
          kind: "direct",
          model: "gpt-5.4",
          tokensIn: 10,
          tokensOut: 20,
          contextWindow: 1000,
          updatedAt: 1,
          label: "Session One",
        },
      ],
      selectedKey: "sess-1",
      history: [
        {
          id: "msg-1",
          role: "assistant",
          content: [
            { type: "thinking", text: "trace" },
            { type: "tool_use", id: "tool-1", name: "bash", input: { command: "ls" } },
            {
              type: "tool_result",
              toolUseId: "tool-1",
              content: [{ type: "text", text: "nested-result" }],
            },
            { type: "image", data: "abc", mimeType: "image/png", fileName: "diagram.png" },
            { type: "file", data: "ZmlsZQ==", mimeType: "text/plain", fileName: "report.txt" },
            {
              type: "unknown",
              rawType: "refusal",
              summary: { type: "refusal", reason: "provider-skew" },
            },
            { type: "text", text: "final answer" },
          ],
          timestamp: 1000,
        },
      ],
    }));
  });

  it("renders transcript blocks instead of flattening history to one string", () => {
    render(<SessionDetail />);

    expect(screen.getByText("trace")).toBeTruthy();
    expect(screen.getByText("bash")).toBeTruthy();
    expect(screen.getByText("nested-result")).toBeTruthy();
    expect(screen.getByText("report.txt")).toBeTruthy();
    expect(screen.getByText("toolResult")).toBeTruthy();
    expect(screen.getByText("Unsupported block: refusal")).toBeTruthy();
    expect(screen.getByText("final answer")).toBeTruthy();
    expect(screen.getByRole("img", { name: "diagram.png" })).toBeTruthy();
    expect(screen.queryByText(/\{"type":"text"/)).toBeNull();
  });
});
