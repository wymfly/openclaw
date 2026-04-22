// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const deckFetch = vi.fn<typeof import("@/lib/deck-client").deckFetch>();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        subagents: "Subagents",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/lib/deck-client", () => ({
  deckFetch,
}));

const chatState = {
  activeSessionKey: "sess-1",
};

vi.mock("@/stores/chat", () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

describe("chat SubagentTree lineage fetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    deckFetch.mockReset();
  });

  it("fetches lineage through the existing deck subagents action route", async () => {
    deckFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          nodes: [
            {
              sessionKey: "child-1",
              agentId: "worker",
              label: "Worker",
              status: "running",
              children: [],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const { SubagentTree } = await import("../SubagentTree");
    render(createElement(SubagentTree));

    await waitFor(() => {
      expect(deckFetch).toHaveBeenCalledWith("/api/deck/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lineage", sessionKey: "sess-1" }),
      });
    });

    expect(await screen.findByText("Worker")).toBeTruthy();
  });
});
