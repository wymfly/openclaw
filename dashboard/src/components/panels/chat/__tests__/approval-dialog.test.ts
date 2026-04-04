// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalDialog } from "../ApprovalDialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        inlineTitle: "Approval required",
        approve: "Approve",
        approveAlways: "Always Approve",
        deny: "Deny",
        pendingBadge: "pending",
      }) as const
    )[key as "inlineTitle" | "approve" | "approveAlways" | "deny" | "pendingBadge"] ?? key,
}));

describe("ApprovalDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T00:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders countdown, metadata, and pending badge", () => {
    render(
      createElement(ApprovalDialog, {
        approval: {
          id: "approval-1",
          toolName: "command",
          command: "rm -rf /tmp/test",
          agentId: "worker-1",
          cwd: "/tmp/project",
          expiresAtMs: Date.now() + 270_000,
        },
        pendingCount: 3,
        onResolve: vi.fn(),
      }),
    );

    expect(screen.getByText("4m 30s")).toBeTruthy();
    expect(screen.getByText("worker-1")).toBeTruthy();
    expect(screen.getByText("/tmp/project")).toBeTruthy();
    expect(screen.getByText("3 pending")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText("4m 29s")).toBeTruthy();
  });

  it("disables buttons while resolve is in progress", () => {
    const onResolve = vi.fn();
    render(
      createElement(ApprovalDialog, {
        approval: {
          id: "approval-1",
          toolName: "command",
        },
        onResolve,
      }),
    );

    const approveButton = screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement;
    const alwaysApproveButton = screen.getByRole("button", {
      name: "Always Approve",
    }) as HTMLButtonElement;
    const denyButton = screen.getByRole("button", { name: "Deny" }) as HTMLButtonElement;

    expect(approveButton.disabled).toBe(false);
    expect(alwaysApproveButton.disabled).toBe(false);
    expect(denyButton.disabled).toBe(false);

    fireEvent.click(approveButton);

    expect(onResolve).toHaveBeenCalledWith("approval-1", "allow-once");
    expect(approveButton.disabled).toBe(true);
    expect(alwaysApproveButton.disabled).toBe(true);
    expect(denyButton.disabled).toBe(true);
  });
});
