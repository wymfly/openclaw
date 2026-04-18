// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WecomOverviewPage } from "./WecomOverviewPage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        overviewTitle: "WeCom Overview",
        overviewDescription:
          "Connection health, account status, and next actions for this channel.",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("./WecomOverviewRoutingSummary", () => ({
  WecomOverviewRoutingSummary: ({
    channelId,
    accountId,
  }: {
    channelId: string;
    accountId?: string;
  }) => <div>{`RoutingSummary:${channelId}:${accountId ?? "none"}`}</div>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WecomOverviewPage", () => {
  it("renders the overview shell and forwards routing summary scope", () => {
    render(<WecomOverviewPage channelId="wecom" accountId="acct-a" />);

    expect(screen.getByRole("heading", { name: "WeCom Overview" })).toBeTruthy();
    expect(
      screen.getByText("Connection health, account status, and next actions for this channel."),
    ).toBeTruthy();
    expect(screen.getByText("RoutingSummary:wecom:acct-a")).toBeTruthy();
  });
});
