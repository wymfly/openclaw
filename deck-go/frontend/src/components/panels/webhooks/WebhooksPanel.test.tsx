// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebhooksPanel } from "./WebhooksPanel";

const apiMocks = vi.hoisted(() => ({
  createWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  fetchWebhookDeliveries: vi.fn(),
  fetchWebhooks: vi.fn(),
  testWebhook: vi.fn(),
  updateWebhook: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function webhook(id: string, name: string, enabled = true) {
  return {
    id,
    name,
    url: `https://example.test/${id}`,
    secret: null,
    events: ["alert.fired", "usage.limit"],
    enabled,
    consecutiveFailures: enabled ? 0 : 2,
    lastFiredAt: null,
    lastStatus: enabled ? 200 : null,
    createdAt: "2026-04-24T00:00:00Z",
    updatedAt: "2026-04-24T00:00:00Z",
  };
}

function webhooksPayload(extra = false) {
  return {
    webhooks: [
      webhook("hook-a", "Alerts"),
      webhook("hook-b", "Usage", false),
      ...(extra ? [webhook("hook-c", "Created Hook")] : []),
    ],
  };
}

function deliveriesPayload(id: string) {
  return {
    deliveries:
      id === "hook-a"
        ? [
            {
              id: "delivery-a",
              webhookId: "hook-a",
              eventType: "alert.fired",
              payload: "{}",
              statusCode: 200,
              error: null,
              durationMs: 12,
              isRetry: false,
              success: true,
              createdAt: "2026-04-24T00:01:00Z",
            },
            {
              id: "delivery-b",
              webhookId: "hook-a",
              eventType: "usage.limit",
              payload: "{}",
              statusCode: 503,
              responseBody: '{"error":"receiver unavailable"}',
              error: null,
              durationMs: 44,
              attempt: 2,
              isRetry: true,
              success: false,
              createdAt: "2026-04-24T00:02:00Z",
            },
          ]
        : [],
  };
}

describe("WebhooksPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.fetchWebhooks.mockResolvedValue(webhooksPayload());
    apiMocks.fetchWebhookDeliveries.mockImplementation((id: string) =>
      Promise.resolve(deliveriesPayload(id)),
    );
    apiMocks.createWebhook.mockResolvedValue(webhook("hook-c", "Created Hook"));
    apiMocks.testWebhook.mockResolvedValue({ ok: true, action: "test" });
    apiMocks.deleteWebhook.mockResolvedValue({ ok: true, action: "delete" });
    apiMocks.updateWebhook.mockResolvedValue(webhook("hook-b", "Usage edited"));
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
    vi.clearAllMocks();
  });

  it("loads webhook inventory, delivery history, and selects the first webhook", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(WebhooksPanel));
    });

    await waitFor(() => expect(apiMocks.fetchWebhooks).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    expect(apiMocks.fetchWebhookDeliveries).toHaveBeenCalledWith("hook-a");
    expect(container.textContent).toContain("2 configured");
    expect(container.textContent).toContain("Alerts");
    expect(container.textContent).toContain("Usage");
    expect(container.textContent).toContain("failures: 2 | last status: n/a");
    expect(container.textContent).toContain("delivery-a");
    expect(container.textContent).toContain("Delivery records");
    expect(container.textContent).toContain("2 deliveries");
    expect(container.textContent).toContain("status 200");
    expect(container.textContent).toContain("duration 12ms");
    expect(container.textContent).toContain("success");
    expect(container.textContent).toContain("usage.limit");
    expect(container.textContent).toContain("status 503");
    expect(container.textContent).toContain("attempt 2");
    expect(container.textContent).toContain("retry");
    expect(container.textContent).toContain('details: {"error":"receiver unavailable"}');
    expect(container.querySelector(".deck-ui-webhooks")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-webhooks-card").length).toBe(2);
    expect(container.querySelectorAll(".deck-ui-webhooks-surface").length).toBe(2);
    expect(container.querySelectorAll(".deck-ui-webhooks-input").length).toBe(4);
    expect(container.querySelectorAll(".deck-ui-webhooks-button").length).toBe(16);
    expect(container.querySelectorAll(".deck-ui-webhooks-row").length).toBe(2);
    expect(container.querySelectorAll(".deck-ui-webhooks-delivery-row").length).toBe(2);
    expect(container.querySelectorAll(".deck-ui-webhooks-hero").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".deck-ui-webhooks-details").length).toBe(2);

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Alerts");
  });

  it("creates, tests, and deletes webhooks while preserving preferred selection", async () => {
    apiMocks.fetchWebhooks
      .mockResolvedValueOnce(webhooksPayload())
      .mockResolvedValue(webhooksPayload(true));

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(WebhooksPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    const nameInput = container.querySelector<HTMLInputElement>('input[aria-label="webhook name"]');
    const urlInput = container.querySelector<HTMLInputElement>('input[aria-label="webhook url"]');
    const secretInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="webhook secret"]',
    );
    const eventsInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="webhook events"]',
    );
    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "Created Hook" } });
      fireEvent.change(urlInput as HTMLInputElement, {
        target: { value: "https://example.test/hook-c" },
      });
      fireEvent.change(secretInput as HTMLInputElement, { target: { value: "secret-value" } });
      container
        .querySelector<HTMLButtonElement>('button[aria-label="toggle webhook event budget.warn"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(eventsInput?.value).toBe("alert.fired, budget.warn");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create webhook")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.createWebhook).toHaveBeenCalledWith({
        name: "Created Hook",
        url: "https://example.test/hook-c",
        secret: "secret-value",
        events: ["alert.fired", "budget.warn"],
        enabled: true,
      }),
    );

    const selectedAfterCreate = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedAfterCreate?.textContent).toContain("Created Hook");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Test delivery")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.testWebhook).toHaveBeenCalledWith("hook-c"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.deleteWebhook).toHaveBeenCalledWith("hook-c"));
    expect(window.confirm).toHaveBeenCalledWith("Delete webhook hook-c?");
  });

  it("does not delete a webhook when confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(WebhooksPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Delete webhook hook-a?");
    expect(apiMocks.deleteWebhook).not.toHaveBeenCalled();
  });

  it("loads selected webhooks into the draft and saves full webhook edits", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(WebhooksPanel));
    });

    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Usage"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Load selected")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const nameInput = container.querySelector<HTMLInputElement>('input[aria-label="webhook name"]');
    const urlInput = container.querySelector<HTMLInputElement>('input[aria-label="webhook url"]');
    const secretInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="webhook secret"]',
    );
    const eventsInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="webhook events"]',
    );
    const enabledInput = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(nameInput?.value).toBe("Usage");
    expect(urlInput?.value).toBe("https://example.test/hook-b");
    expect(secretInput?.value).toBe("");
    expect(eventsInput?.value).toBe("alert.fired, usage.limit");
    expect(enabledInput.checked).toBe(false);

    await act(async () => {
      fireEvent.change(nameInput as HTMLInputElement, { target: { value: "Usage edited" } });
      fireEvent.change(urlInput as HTMLInputElement, {
        target: { value: "https://example.test/edited" },
      });
      fireEvent.change(secretInput as HTMLInputElement, { target: { value: "new-secret" } });
      fireEvent.change(eventsInput as HTMLInputElement, {
        target: { value: "agent.updated, alert.fired" },
      });
      container
        .querySelector<HTMLButtonElement>('button[aria-label="toggle webhook event budget.warn"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      fireEvent.click(enabledInput);
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save selected")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.updateWebhook).toHaveBeenCalledWith("hook-b", {
        name: "Usage edited",
        url: "https://example.test/edited",
        secret: "new-secret",
        events: ["agent.updated", "alert.fired", "budget.warn"],
        enabled: true,
      }),
    );
  });
});
