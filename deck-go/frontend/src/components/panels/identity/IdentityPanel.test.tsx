// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider, type NextIntlClientProviderProps } from "../../../i18n/provider";
import { IdentityPanel } from "./IdentityPanel";

const apiMocks = vi.hoisted(() => ({
  fetchIdentityLinks: vi.fn(),
  linkIdentityPeer: vi.fn(),
  unlinkIdentityPeer: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function identityPayload(includeNew = false, includeEmpty = false) {
  return {
    configHash: includeNew ? "hash-2" : "hash-1",
    links: [
      ...(includeEmpty
        ? [
            {
              canonical: "empty",
              peers: [],
            },
          ]
        : []),
      {
        canonical: "main",
        peers: [
          { channel: "telegram", peerId: "tg-main" },
          { channel: "discord", peerId: "disc-main" },
        ],
      },
      {
        canonical: "builder",
        peers: [{ channel: "slack", peerId: "slack-builder" }],
      },
      ...(includeNew
        ? [
            {
              canonical: "reviewer",
              peers: [{ channel: "telegram", peerId: "tg-reviewer" }],
            },
          ]
        : []),
    ],
  };
}

function identityPayloadWithoutHash() {
  return {
    links: [
      {
        canonical: "main",
        peers: [{ channel: "telegram", peerId: "tg-main" }],
      },
    ],
  };
}

function renderPanel(locale: NextIntlClientProviderProps["locale"] = "en") {
  act(() => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale }, createElement(IdentityPanel)));
  });
}

function buttonByText(text: string) {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  );
}

function rowByText(text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find((row) =>
    row.textContent?.includes(text),
  );
}

function inputByLabel(label: string) {
  return container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
}

async function openLinkDialog() {
  await act(async () => {
    buttonByText("+ Link Identity")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function fillLinkDialog(input: { canonical: string; channel: string; peerId: string }) {
  await act(async () => {
    fireEvent.change(inputByLabel("identity canonical") as HTMLInputElement, {
      target: { value: input.canonical },
    });
    fireEvent.change(inputByLabel("identity channel") as HTMLInputElement, {
      target: { value: input.channel },
    });
    fireEvent.change(inputByLabel("identity peer id") as HTMLInputElement, {
      target: { value: input.peerId },
    });
  });
}

describe("IdentityPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.fetchIdentityLinks.mockResolvedValue(identityPayload());
    apiMocks.linkIdentityPeer.mockResolvedValue({ ok: true, canonical: "reviewer" });
    apiMocks.unlinkIdentityPeer.mockResolvedValue({ ok: true, canonical: "builder" });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("loads canonical links into the old Deck split identity layout", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    expect(container.textContent).toContain("Identity ready");
    expect(container.textContent).toContain("2 canonicals");
    expect(container.textContent).toContain("3 peers");
    expect(container.textContent).toContain("hash hash-1");
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("telegram: tg-main");
    expect(container.textContent).toContain("discord: disc-main");
    expect(container.querySelector(".deck-ui-control-shell.deck-ui-identity")).toBeTruthy();
    expect(container.querySelector(".deck-ui-control-sidebar")).toBeTruthy();
    expect(container.querySelector(".deck-ui-control-detail")).toBeTruthy();
    expect(container.querySelector(".deck-ui-identity-dialog")).toBeFalsy();

    const selectedRow = rowByText("main");
    expect(selectedRow?.className).toContain("is-selected");
  });

  it("shows empty peer state in both the list and selected detail", async () => {
    apiMocks.fetchIdentityLinks.mockResolvedValue(identityPayload(false, true));
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    expect(container.textContent).toContain("empty");
    expect(container.textContent).toContain("No peers linked");
    expect(container.textContent).toContain("No peers linked to this canonical.");
    expect(container.textContent).toContain("slack: slack-builder");
  });

  it("links a trimmed peer with the config hash and preserves the preferred canonical", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));
    apiMocks.fetchIdentityLinks.mockResolvedValue(identityPayload(true));

    await openLinkDialog();
    await fillLinkDialog({
      canonical: " reviewer ",
      channel: " telegram ",
      peerId: " tg-reviewer ",
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    });

    await waitFor(() =>
      expect(apiMocks.linkIdentityPeer).toHaveBeenCalledWith(
        "reviewer",
        "telegram",
        "tg-reviewer",
        "hash-1",
      ),
    );
    await waitFor(() => expect(container.textContent).toContain("Last identity action"));
    expect(rowByText("reviewer")?.className).toContain("is-selected");
  });

  it("validates link drafts before calling the identity mutation route", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));
    await openLinkDialog();

    expect(buttonByText("Save")).toBeTruthy();
    expect((buttonByText("Save") as HTMLButtonElement).disabled).toBe(true);
    expect(apiMocks.linkIdentityPeer).not.toHaveBeenCalled();
  });

  it("refreshes identity config hash after a failed link mutation", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));
    apiMocks.linkIdentityPeer.mockRejectedValueOnce(new Error("base hash mismatch"));
    apiMocks.fetchIdentityLinks.mockResolvedValue(identityPayload(true));

    await openLinkDialog();
    await fillLinkDialog({
      canonical: " reviewer ",
      channel: " telegram ",
      peerId: " tg-reviewer ",
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    });

    await waitFor(() => expect(container.textContent).toContain("base hash mismatch"));
    await waitFor(() => expect(container.textContent).toContain("hash hash-2"));
  });

  it("blocks identity mutations when the config hash is missing", async () => {
    apiMocks.fetchIdentityLinks.mockResolvedValue(identityPayloadWithoutHash());
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));
    await openLinkDialog();
    await fillLinkDialog({
      canonical: " reviewer ",
      channel: " telegram ",
      peerId: " tg-reviewer ",
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    });

    await waitFor(() =>
      expect(container.textContent).toContain(
        "identity config hash is required; refresh identity links first",
      ),
    );
    expect(apiMocks.linkIdentityPeer).not.toHaveBeenCalled();

    await act(async () => {
      container
        .querySelector<HTMLElement>('[aria-label="Unlink telegram:tg-main"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(apiMocks.unlinkIdentityPeer).not.toHaveBeenCalled();
  });

  it("unlinks the selected canonical peer with the config hash", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));
    await act(async () => {
      rowByText("builder")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttonByText("Unlink peer")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.unlinkIdentityPeer).toHaveBeenCalledWith(
        "builder",
        "slack",
        "slack-builder",
        "hash-1",
      ),
    );
    expect(window.confirm).toHaveBeenCalledWith("Unlink slack:slack-builder from builder?");
    expect(container.textContent).toContain("Last identity action");
  });

  it("unlinks directly from peer badges without changing selection first", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));
    await act(async () => {
      container
        .querySelector<HTMLElement>('[aria-label="Unlink discord:disc-main"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.unlinkIdentityPeer).toHaveBeenCalledWith(
        "main",
        "discord",
        "disc-main",
        "hash-1",
      ),
    );
    expect(window.confirm).toHaveBeenCalledWith("Unlink discord:disc-main from main?");
  });

  it("does not unlink a peer when unlink confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));
    await act(async () => {
      rowByText("builder")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      buttonByText("Unlink peer")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Unlink slack:slack-builder from builder?");
    expect(apiMocks.unlinkIdentityPeer).not.toHaveBeenCalled();
  });

  it("renders the migrated identity shell in Chinese", async () => {
    renderPanel("zh");

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    expect(container.textContent).toContain("身份就绪");
    expect(container.textContent).toContain("2 个统一身份");
    expect(container.textContent).toContain("3 个 peer");
    expect(container.textContent).toContain("关联身份");
  });
});
