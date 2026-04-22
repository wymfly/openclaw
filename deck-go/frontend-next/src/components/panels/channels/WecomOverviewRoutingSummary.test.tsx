// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WecomOverviewRoutingSummary } from "./WecomOverviewRoutingSummary";

const { navigateToRouting } = vi.hoisted(() => ({
  navigateToRouting: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    (
      ({
        summaryTitle: "Routing Scope Summary",
        summaryBindings: `Bindings in scope: ${values?.count ?? ""}`,
        openRouting: "View all routing rules",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/lib/panel-navigation", () => ({
  navigateToRouting,
}));

vi.mock("@/stores/deck-routing", () => ({
  useDeckRoutingStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      bindings: [
        { id: "b1", match: { channel: "wecom", accountId: "acct-a" } },
        { id: "b2", match: { channel: "wecom" } },
        { id: "b3", match: { channel: "telegram", accountId: "acct-a" } },
      ],
      fetchBindings: vi.fn(async () => {}),
    }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WecomOverviewRoutingSummary", () => {
  it("shows bindings in scope and routes with channel/account context", () => {
    render(<WecomOverviewRoutingSummary channelId="wecom" accountId="acct-a" />);

    expect(screen.getByRole("heading", { name: "Routing Scope Summary" })).toBeTruthy();
    expect(screen.getByText("Bindings in scope: 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View all routing rules" }));

    expect(navigateToRouting).toHaveBeenCalledWith({
      channelId: "wecom",
      accountId: "acct-a",
    });
  });
});
