// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../../i18n/provider";
import { probeSuccessFixture } from "../__fixtures__/channels.fixture";
import type { ChannelTranslator } from "../types";
import { LogoutDialog } from "./LogoutDialog";
import { TestResultDialog } from "./TestResultDialog";

const t: ChannelTranslator = ((key: string, values?: Record<string, unknown>) => {
  if (!values) {
    return key;
  }
  const formatted = Object.entries(values)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(",");
  return `${key}{${formatted}}`;
}) as ChannelTranslator;
(t as { rich?: unknown }).rich = (key: string) => key;
(t as { raw?: unknown }).raw = (key: string) => key;

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: ReturnType<typeof createElement>) {
  await act(async () => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale: "en" }, node));
  });
}

function buttonByText(text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

describe("channels dialogs", () => {
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

  it("TestResultDialog renders probe payload and closes via close button", async () => {
    const onClose = vi.fn();
    await render(
      createElement(TestResultDialog, {
        channelLabel: "Discord",
        result: probeSuccessFixture(),
        t,
        onClose,
      }),
    );
    expect(container.textContent).toContain("testResultDialogTitle");
    expect(container.textContent).toContain("probeSuccess");
    expect(container.textContent).toContain("42ms");
    expect(container.textContent).toContain("Discord");

    const close = container.querySelector<HTMLButtonElement>("button[aria-label='closeDialog']");
    expect(close).toBeTruthy();
    await act(async () => {
      close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("TestResultDialog closes on backdrop click but not on body click", async () => {
    const onClose = vi.fn();
    await render(
      createElement(TestResultDialog, {
        channelLabel: "Discord",
        result: probeSuccessFixture(),
        t,
        onClose,
      }),
    );
    const backdrop = container.querySelector(".modal-backdrop");
    expect(backdrop).toBeTruthy();
    await act(async () => {
      backdrop?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    const body = container.querySelector(".modal__body");
    await act(async () => {
      body?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("LogoutDialog confirms via confirm button when idle", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    await render(
      createElement(LogoutDialog, {
        channelId: "discord",
        actionState: "idle",
        t,
        onCancel,
        onConfirm,
      }),
    );
    expect(container.textContent).toContain("logoutConfirmTitle");
    expect(container.textContent).toContain("logoutConfirmDescription{channelId=discord}");

    const confirmBtn = buttonByText("confirmLogoutAction");
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn?.hasAttribute("disabled")).toBe(false);
    await act(async () => {
      confirmBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("LogoutDialog cancels via cancel button and disables confirm during logout", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    await render(
      createElement(LogoutDialog, {
        channelId: "discord",
        actionState: "logging-out",
        t,
        onCancel,
        onConfirm,
      }),
    );
    expect(container.textContent).toContain("loggingOut");
    const confirmBtn = buttonByText("loggingOut");
    expect(confirmBtn?.hasAttribute("disabled")).toBe(true);
    const cancelBtn = buttonByText("cancel");
    await act(async () => {
      cancelBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
