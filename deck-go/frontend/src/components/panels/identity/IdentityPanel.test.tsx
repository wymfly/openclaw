// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("loads canonical links and selects the first canonical by default", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IdentityPanel));
    });

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    expect(container.textContent).toContain("Identity ready");
    expect(container.textContent).toContain("2 canonicals");
    expect(container.textContent).toContain("hash hash-1");
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("telegram: tg-main");
    expect(container.textContent).toContain("discord: disc-main");
    expect(container.textContent).toContain("telegram");
    expect(container.textContent).toContain("tg-main");
    expect(container.querySelector(".deck-ui-identity")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-identity-card")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-identity-body")).toHaveLength(2);
    expect(container.querySelector(".deck-ui-identity-status-row")).toBeTruthy();
    expect(container.querySelector(".deck-ui-identity-stats")).toBeTruthy();
    expect(container.querySelector(".deck-ui-identity-surface")).toBeTruthy();
    expect(container.querySelector(".deck-ui-identity-form-grid")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-identity-input")).toHaveLength(3);
    expect(container.querySelector(".deck-ui-identity-actions")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-identity-button").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll(".deck-ui-identity-list")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-identity-row").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".deck-ui-identity-peer-pills")).toBeTruthy();
    expect(container.querySelector(".deck-ui-identity-hero")).toBeTruthy();

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("main");
  });

  it("shows peer badges and empty peer state in the canonical list", async () => {
    apiMocks.fetchIdentityLinks.mockResolvedValue(identityPayload(false, true));

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IdentityPanel));
    });

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    expect(container.textContent).toContain("empty");
    expect(container.textContent).toContain("No peers linked");
    expect(container.textContent).toContain("No peers linked to this canonical.");
    expect(container.textContent).toContain("slack: slack-builder");
  });

  it("links a trimmed peer with the config hash and preserves the preferred canonical", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IdentityPanel));
    });

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    const canonicalInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="canonical"]',
    );
    const channelInput = container.querySelector<HTMLInputElement>('input[placeholder="channel"]');
    const peerInput = container.querySelector<HTMLInputElement>('input[placeholder="peer id"]');
    expect(canonicalInput).toBeTruthy();
    expect(channelInput).toBeTruthy();
    expect(peerInput).toBeTruthy();

    apiMocks.fetchIdentityLinks.mockResolvedValue(identityPayload(true));

    await act(async () => {
      fireEvent.change(canonicalInput as HTMLInputElement, { target: { value: " reviewer " } });
      fireEvent.change(channelInput as HTMLInputElement, { target: { value: " telegram " } });
      fireEvent.change(peerInput as HTMLInputElement, { target: { value: " tg-reviewer " } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Link identity")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("reviewer");
  });

  it("validates link drafts before calling the identity mutation route", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IdentityPanel));
    });

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    const linkButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Link identity",
    );

    expect(linkButton).toBeTruthy();
    expect((linkButton as HTMLButtonElement).disabled).toBe(true);
    expect(apiMocks.linkIdentityPeer).not.toHaveBeenCalled();
  });

  it("refreshes identity config hash after a failed link mutation", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IdentityPanel));
    });

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));
    apiMocks.linkIdentityPeer.mockRejectedValueOnce(new Error("base hash mismatch"));
    apiMocks.fetchIdentityLinks.mockResolvedValue(identityPayload(true));

    await act(async () => {
      fireEvent.change(
        container.querySelector('input[placeholder="canonical"]') as HTMLInputElement,
        {
          target: { value: " reviewer " },
        },
      );
      fireEvent.change(
        container.querySelector('input[placeholder="channel"]') as HTMLInputElement,
        {
          target: { value: " telegram " },
        },
      );
      fireEvent.change(
        container.querySelector('input[placeholder="peer id"]') as HTMLInputElement,
        {
          target: { value: " tg-reviewer " },
        },
      );
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Link identity")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(container.textContent).toContain("base hash mismatch"));
    await waitFor(() => expect(container.textContent).toContain("hash hash-2"));
  });

  it("blocks identity mutations when the config hash is missing", async () => {
    apiMocks.fetchIdentityLinks.mockResolvedValue(identityPayloadWithoutHash());

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IdentityPanel));
    });

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    await act(async () => {
      fireEvent.change(
        container.querySelector('input[placeholder="canonical"]') as HTMLInputElement,
        {
          target: { value: " reviewer " },
        },
      );
      fireEvent.change(
        container.querySelector('input[placeholder="channel"]') as HTMLInputElement,
        {
          target: { value: " telegram " },
        },
      );
      fireEvent.change(
        container.querySelector('input[placeholder="peer id"]') as HTMLInputElement,
        {
          target: { value: " tg-reviewer " },
        },
      );
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Link identity")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(container.textContent).toContain(
        "identity config hash is required; refresh identity links first",
      ),
    );
    expect(apiMocks.linkIdentityPeer).not.toHaveBeenCalled();

    const inlineUnlink = container.querySelector<HTMLElement>(
      '[aria-label="Unlink telegram:tg-main"]',
    );
    expect(inlineUnlink).toBeTruthy();
    await act(async () => {
      inlineUnlink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(apiMocks.unlinkIdentityPeer).not.toHaveBeenCalled();
  });

  it("unlinks the selected canonical peer with the config hash", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IdentityPanel));
    });

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    const builderButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("builder"),
    );
    expect(builderButton).toBeTruthy();

    await act(async () => {
      builderButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Unlink")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IdentityPanel));
    });

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    const inlineUnlink = container.querySelector<HTMLElement>(
      '[aria-label="Unlink discord:disc-main"]',
    );
    expect(inlineUnlink).toBeTruthy();

    await act(async () => {
      inlineUnlink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(IdentityPanel));
    });

    await waitFor(() => expect(apiMocks.fetchIdentityLinks).toHaveBeenCalledTimes(1));

    const builderButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("builder"),
    );
    expect(builderButton).toBeTruthy();

    await act(async () => {
      builderButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Unlink")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Unlink slack:slack-builder from builder?");
    expect(apiMocks.unlinkIdentityPeer).not.toHaveBeenCalled();
  });
});
