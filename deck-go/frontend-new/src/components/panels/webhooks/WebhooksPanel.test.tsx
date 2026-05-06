// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
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

function webhook(id: string, name: string, enabled = true, failures = 0) {
  return {
    id,
    name,
    url: `https://example.test/${id}`,
    secret: id === "hook-a" ? "***redacted" : null,
    events: ["alert.fired", "usage.limit"],
    enabled,
    consecutiveFailures: failures,
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
      webhook("hook-b", "Usage", false, 2),
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
              payload: '{"event":"alert.fired"}',
              statusCode: 200,
              error: null,
              durationMs: 12,
              attempt: 0,
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
              parentDeliveryId: "delivery-a",
              success: false,
              createdAt: "2026-04-24T00:02:00Z",
            },
          ]
        : [],
  };
}

function renderWebhooksPanel() {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale: "en" }, createElement(WebhooksPanel)));
}

function button(label: string | RegExp) {
  const matcher =
    typeof label === "string"
      ? (value: string | null) => value === label
      : (value: string | null) => Boolean(value && label.test(value));
  const found = Array.from(container.querySelectorAll("button")).find((candidate) =>
    matcher(candidate.textContent),
  );
  expect(found, `expected button ${String(label)}`).toBeTruthy();
  return found as HTMLButtonElement;
}

describe("WebhooksPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchWebhooks.mockResolvedValue(webhooksPayload());
    apiMocks.fetchWebhookDeliveries.mockImplementation((id: string) =>
      Promise.resolve(deliveriesPayload(id)),
    );
    apiMocks.createWebhook.mockResolvedValue(webhook("hook-c", "Created Hook"));
    apiMocks.testWebhook.mockResolvedValue({ deliveryId: "delivery-c", success: true });
    apiMocks.deleteWebhook.mockResolvedValue({ deleted: true });
    apiMocks.updateWebhook.mockResolvedValue(webhook("hook-b", "Usage edited", true, 0));
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
  });

  it("loads receiver inventory, KPIs, detail tabs, and sanitized webhook evidence", async () => {
    await act(async () => {
      renderWebhooksPanel();
    });

    await waitFor(() => expect(apiMocks.fetchWebhooks).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    expect(apiMocks.fetchWebhookDeliveries).toHaveBeenCalledWith("hook-a");
    expect(container.querySelector(".webhooks-panel__workspace")).toBeTruthy();
    expect(container.querySelector(".webhooks-panel__list-pane")).toBeTruthy();
    expect(container.querySelector(".webhooks-panel__detail-pane")).toBeTruthy();
    expect(container.textContent).toContain("Receiver inventory");
    expect(container.textContent).toContain("Alerts");
    expect(container.textContent).toContain("Usage");
    expect(container.textContent).toContain("Healthy");
    expect(container.textContent).toContain("Disabled");
    expect(container.textContent).toContain("redacted");
    expect(container.textContent).not.toContain("visual-secret");
    expect(container.textContent).toContain("Overview");
    expect(container.textContent).toContain("Deliveries");
    expect(container.textContent).toContain("Gaps");
  });

  it("filters receivers and switches selected webhook delivery state", async () => {
    await act(async () => {
      renderWebhooksPanel();
    });
    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="name, url, id, or event"]',
    );
    expect(search).toBeTruthy();
    await act(async () => {
      fireEvent.change(search as HTMLInputElement, { target: { value: "hook-b" } });
    });
    expect(container.textContent).toContain("Usage");
    expect(container.querySelector(".webhooks-panel__list")?.textContent).not.toContain("Alerts");

    await act(async () => {
      button(/Usage/).click();
    });
    await waitFor(() => expect(apiMocks.fetchWebhookDeliveries).toHaveBeenCalledWith("hook-b"));
    await act(async () => {
      button("Deliveries").click();
    });
    expect(container.textContent).toContain("No delivery records");
  });

  it("expands delivery rows to reveal payload and response evidence", async () => {
    await act(async () => {
      renderWebhooksPanel();
    });
    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    await act(async () => {
      button("Deliveries").click();
    });
    expect(container.textContent).toContain("alert.fired");
    expect(container.textContent).toContain("usage.limit");

    await act(async () => {
      button(/usage\.limit/).click();
    });
    expect(container.textContent).toContain("Response body");
    expect(container.textContent).toContain("receiver unavailable");
    expect(container.textContent).toContain("parent: delivery-a");
  });

  it("creates, tests, and deletes webhooks through guarded flows", async () => {
    apiMocks.fetchWebhooks
      .mockResolvedValueOnce(webhooksPayload())
      .mockResolvedValue(webhooksPayload(true));

    await act(async () => {
      renderWebhooksPanel();
    });
    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    await act(async () => {
      button("New Webhook").click();
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("New Webhook");

    const nameInput = container.querySelector<HTMLInputElement>('input[aria-label="webhook name"]');
    const urlInput = container.querySelector<HTMLInputElement>('input[aria-label="webhook url"]');
    const secretInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="webhook secret"]',
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

    await act(async () => {
      button("Create webhook").click();
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
    await waitFor(() =>
      expect(
        Array.from(container.querySelectorAll("button")).find((candidate) =>
          candidate.className.includes("is-selected"),
        )?.textContent,
      ).toContain("Created Hook"),
    );

    await act(async () => {
      fireEvent.click(button("Test Delivery"));
    });
    await waitFor(() => expect(apiMocks.testWebhook).toHaveBeenCalledWith("hook-c"));

    await act(async () => {
      fireEvent.click(button("Delete Webhook"));
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Delete this webhook?",
    );
    await act(async () => {
      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
      const confirm = Array.from(dialog.querySelectorAll("button")).find(
        (candidate) => candidate.textContent === "Delete Webhook",
      );
      fireEvent.click(confirm as HTMLButtonElement);
    });
    await waitFor(() => expect(apiMocks.deleteWebhook).toHaveBeenCalledWith("hook-c"));
  });

  it("closes guarded builder and delete dialogs with Escape while idle", async () => {
    await act(async () => {
      renderWebhooksPanel();
    });
    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    await act(async () => {
      button("New Webhook").click();
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("New Webhook");

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      button("Delete Webhook").click();
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Delete this webhook?",
    );

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("loads selected webhooks into the modal without exposing stored secrets and saves edits", async () => {
    await act(async () => {
      renderWebhooksPanel();
    });
    await waitFor(() => expect(container.textContent).toContain("Webhooks ready"));

    await act(async () => {
      button(/Usage/).click();
    });
    await act(async () => {
      button("Edit Webhook").click();
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
    });
    await waitFor(() => expect(eventsInput?.value).toBe("agent.updated, alert.fired"));
    await act(async () => {
      fireEvent.click(
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="toggle webhook event budget.warn"]',
        ) as HTMLButtonElement,
      );
    });
    await waitFor(() => expect(eventsInput?.value).toBe("agent.updated, alert.fired, budget.warn"));
    await act(async () => {
      fireEvent.click(enabledInput);
    });

    await act(async () => {
      button("Save selected").click();
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
