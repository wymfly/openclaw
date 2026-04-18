// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WecomPageShellNav } from "./WecomPageShellNav";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        sectionLabel: "WeCom Pages",
        overview: "Overview",
        onboarding: "Onboarding",
        access: "Access",
      }) as Record<string, string>
    )[key] ?? key,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WecomPageShellNav", () => {
  it("renders only the requested page entries and reports selection", () => {
    const onSelect = vi.fn();

    render(
      <WecomPageShellNav
        activePage="overview"
        pages={["overview", "onboarding", "access"]}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("WeCom Pages")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Overview", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Onboarding", pressed: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Access", pressed: false })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Access", pressed: false }));
    expect(onSelect).toHaveBeenCalledWith("access");
  });
});
