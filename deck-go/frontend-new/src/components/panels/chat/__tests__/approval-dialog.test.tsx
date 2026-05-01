// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
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
      }) as Record<string, string>
    )[key] ?? key,
}));

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container.remove();
  vi.restoreAllMocks();
});

describe("ApprovalDialog", () => {
  it("renders approval context and resolves with the selected decision", () => {
    const onResolve = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(ApprovalDialog, {
          approval: {
            id: "approval-1",
            toolName: "shell",
            command: "npm test",
            agentId: "main",
            cwd: "/workspace",
            expiresAtMs: Date.now() + 60_000,
          },
          pendingCount: 2,
          onResolve,
        }),
      );
    });

    expect(screen.getByText("Approval required")).toBeTruthy();
    expect(screen.getByText("shell")).toBeTruthy();
    expect(screen.getByText("npm test")).toBeTruthy();
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("/workspace")).toBeTruthy();
    expect(screen.getByText("2 pending")).toBeTruthy();

    const approveButton = screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement;
    act(() => {
      fireEvent.click(approveButton);
    });

    expect(onResolve).toHaveBeenCalledWith("approval-1", "allow-once");
    expect(approveButton.disabled).toBe(true);
  });
});
