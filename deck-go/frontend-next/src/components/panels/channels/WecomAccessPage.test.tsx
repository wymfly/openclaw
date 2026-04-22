// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WecomAccessPage } from "./WecomAccessPage";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        title: "WeCom Access Controls",
        description:
          "Manage who can use this channel, how direct messages are authorized, and how dynamic agents behave.",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("./ChannelAccessTab", () => ({
  ChannelAccessTab: ({ selectedAccountId }: { selectedAccountId?: string }) => (
    <div>{`Access Host:${selectedAccountId ?? "none"}`}</div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WecomAccessPage", () => {
  it("stays a thin shell and forwards directly into ChannelAccessTab", () => {
    render(
      <WecomAccessPage
        channelId="wecom"
        channel={{
          id: "wecom",
          label: "WeCom",
          accounts: [{ accountId: "default" }],
        }}
        selectedAccountId="default"
      />,
    );

    expect(screen.getByText("Access Host:default")).toBeTruthy();
  });
});
