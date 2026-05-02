// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeckIntlProvider } from "../../i18n/provider";
import { useNotificationsStore } from "../../stores/notifications";
import { ToastContainer } from "./ToastContainer";

let container: HTMLDivElement;
let root: Root | null = null;

function renderWithLocale(locale: "en" | "zh") {
  act(() => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale }, createElement(ToastContainer)));
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  useNotificationsStore.setState({ toasts: [] });
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
  useNotificationsStore.setState({ toasts: [] });
});

describe("ToastContainer", () => {
  it("renders and dismisses localized toasts from the shared notification store", () => {
    useNotificationsStore.getState().addToast("success", "Saved", 0);
    renderWithLocale("zh");

    expect(container.textContent).toContain("成功");
    expect(container.textContent).toContain("Saved");
    act(() => {
      container.querySelector<HTMLButtonElement>('[aria-label="关闭"]')?.click();
    });
    expect(useNotificationsStore.getState().toasts).toHaveLength(0);
  });
});
