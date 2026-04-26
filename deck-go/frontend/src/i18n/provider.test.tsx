import { DeckIntlProvider, useLocale, useSetLocale, useTranslations } from "next-intl";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function TranslationProbe({ namespace }: { namespace: string }) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useTranslations(namespace);

  return (
    <div>
      <div data-testid="locale">{locale}</div>
      <div data-testid="text">{t("send")}</div>
      <div data-testid="formatted">{t("totalCount", { count: 3 })}</div>
      <div data-testid="has-send">{String(t.has("send"))}</div>
      <div data-testid="has-missing">{String(t.has("missing"))}</div>
      <button type="button" onClick={() => setLocale(locale === "zh" ? "en" : "zh")}>
        switch
      </button>
    </div>
  );
}

let container: HTMLDivElement;
let root: Root | null = null;

function query(testId: string): string {
  const value = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.textContent;
  if (value == null) {
    throw new Error(`missing test id: ${testId}`);
  }
  return value;
}

describe("DeckIntlProvider", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    document.cookie = "NEXT_LOCALE=;path=/;max-age=0";
    window.localStorage.clear();
    document.documentElement.lang = "";
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
  });

  it("uses the persisted locale and exposes hook-compatible translations", async () => {
    document.cookie = "NEXT_LOCALE=en;path=/";

    await act(async () => {
      root = createRoot(container);
      root.render(
        <DeckIntlProvider>
          <TranslationProbe namespace="chat" />
        </DeckIntlProvider>,
      );
    });

    expect(query("locale")).toBe("en");
    expect(query("text")).toBe("Send");
    expect(query("has-send")).toBe("true");
    expect(query("has-missing")).toBe("false");
    expect(document.documentElement.lang).toBe("en");
  });

  it("falls back to local storage when the locale cookie is absent", async () => {
    window.localStorage.setItem("deckGoLocale", "zh");

    await act(async () => {
      root = createRoot(container);
      root.render(
        <DeckIntlProvider>
          <TranslationProbe namespace="lists" />
        </DeckIntlProvider>,
      );
    });

    expect(query("locale")).toBe("zh");
    expect(query("formatted")).toBe("共 3 项");
    expect(document.documentElement.lang).toBe("zh");
  });

  it("switches locale in-place while preserving NEXT_LOCALE compatibility", async () => {
    window.localStorage.setItem("deckGoLocale", "zh");

    await act(async () => {
      root = createRoot(container);
      root.render(
        <DeckIntlProvider>
          <TranslationProbe namespace="chat" />
        </DeckIntlProvider>,
      );
    });

    expect(query("locale")).toBe("zh");
    expect(query("text")).toBe("发送");

    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(query("locale")).toBe("en");
    expect(query("text")).toBe("Send");
    expect(document.cookie).toContain("NEXT_LOCALE=en");
    expect(window.localStorage.getItem("deckGoLocale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
