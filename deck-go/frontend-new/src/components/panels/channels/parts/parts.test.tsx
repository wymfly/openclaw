// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../../i18n/provider";
import {
  emptyThroughputFixture,
  probeFailureFixture,
  probeSuccessFixture,
  probeTimeoutFixture,
  telegramDiscordChannelsFixture,
  throughputFixture,
} from "../__fixtures__/channels.fixture";
import { buildChannelInventory } from "../lib/channel-selectors";
import type { ChannelInventoryItem, ChannelTranslator } from "../types";
import { ChannelGlyph } from "./ChannelGlyph";
import { ChannelInventoryRow } from "./ChannelInventoryRow";
import { ChannelProbeResultBadge } from "./ChannelProbeResultBadge";
import { ChannelThroughputChart } from "./ChannelThroughputChart";
import { MetricTile } from "./MetricTile";

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

describe("channels parts", () => {
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

  it("ChannelGlyph renders the first two letters in uppercase with channel id", async () => {
    await render(createElement(ChannelGlyph, { id: "telegram", label: "Telegram" }));
    const glyph = container.querySelector(".channels-glyph");
    expect(glyph?.textContent).toBe("TE");
    expect(glyph?.getAttribute("data-channel")).toBe("telegram");
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
  });

  it("MetricTile renders label, value, and optional hint", async () => {
    await render(createElement(MetricTile, { label: "Channels", value: 3, hint: "Operational" }));
    expect(container.textContent).toContain("Channels");
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("Operational");
  });

  it("MetricTile omits hint when not provided", async () => {
    await render(createElement(MetricTile, { label: "Accounts", value: "12" }));
    expect(container.querySelector(".kpi__hint")).toBeNull();
  });

  it("ChannelProbeResultBadge shows success state with latency", async () => {
    await render(createElement(ChannelProbeResultBadge, { result: probeSuccessFixture(), t }));
    expect(container.textContent).toContain("probeSuccess");
    expect(container.textContent).toContain("42ms");
  });

  it("ChannelProbeResultBadge shows timeout state with error", async () => {
    await render(createElement(ChannelProbeResultBadge, { result: probeTimeoutFixture(), t }));
    expect(container.textContent).toContain("probeTimeout");
    expect(container.textContent).toContain("request timeout");
  });

  it("ChannelProbeResultBadge shows failure state without latency", async () => {
    await render(createElement(ChannelProbeResultBadge, { result: probeFailureFixture(), t }));
    expect(container.textContent).toContain("probeFailure");
    expect(container.textContent).toContain("auth failed");
    expect(container.querySelector(".deckgo-pill")?.classList.contains("is-danger")).toBe(true);
  });

  it("ChannelThroughputChart renders empty state when buckets are empty", async () => {
    const fixture = emptyThroughputFixture();
    await render(
      createElement(ChannelThroughputChart, {
        buckets: fixture.buckets ?? [],
        messagesIn: 0,
        messagesOut: 0,
        window: "1h",
        t,
      }),
    );
    expect(container.textContent).toContain("noThroughputBucketsTitle");
  });

  it("ChannelThroughputChart renders chart bars when buckets exist", async () => {
    const fixture = throughputFixture();
    await render(
      createElement(ChannelThroughputChart, {
        buckets: fixture.buckets ?? [],
        messagesIn: fixture.messagesIn ?? 0,
        messagesOut: fixture.messagesOut ?? 0,
        window: "1h",
        t,
      }),
    );
    expect(container.querySelector("[data-testid='channel-throughput-chart']")).toBeTruthy();
    expect(container.querySelectorAll(".chart__bar").length).toBe(fixture.buckets?.length ?? 0);
  });

  it("ChannelInventoryRow shows alerts pill when alertCount > 0", async () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    const item: ChannelInventoryItem = items[1];
    expect(item.alertCount).toBeGreaterThan(0);
    let selected = "";
    await render(
      createElement(ChannelInventoryRow, {
        item,
        selected: false,
        totalMessagesIn: 0,
        t,
        onSelect: (id: string) => {
          selected = id;
        },
      }),
    );
    const button = container.querySelector("button.row");
    expect(button).toBeTruthy();
    expect(container.textContent).toContain("alertsBadge");
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(selected).toBe(item.id);
  });

  it("ChannelInventoryRow renders disabled pill when item.enabled is false", async () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    const item: ChannelInventoryItem = { ...items[0], enabled: false };
    await render(
      createElement(ChannelInventoryRow, {
        item,
        selected: true,
        totalMessagesIn: 0,
        t,
        onSelect: () => undefined,
      }),
    );
    const button = container.querySelector("button.row");
    expect(button?.classList.contains("is-selected")).toBe(true);
    expect(container.textContent).toContain("disabled");
  });
});
