// @vitest-environment jsdom
import { fireEvent } from "@testing-library/react";
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../../i18n/provider";
import {
  emptyChannelsFixture,
  telegramDiscordChannelsFixture,
} from "../__fixtures__/channels.fixture";
import {
  applyChannelFilter,
  buildChannelInventory,
  summarizeInventoryTotals,
} from "../lib/channel-selectors";
import { FILTERS } from "../types";
import type { ChannelFilter, ChannelTranslator } from "../types";
import { ChannelsListView } from "./ChannelsListView";

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

function buildFilterCounts(items: ReturnType<typeof buildChannelInventory>) {
  const counts = {} as Record<ChannelFilter, number>;
  for (const filter of FILTERS) {
    counts[filter] = applyChannelFilter(items, filter, "").length;
  }
  return counts;
}

describe("ChannelsListView", () => {
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

  it("renders v2 list shell with kpi strip, toolbar, and rows", async () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    const onSelect = vi.fn();
    await render(
      createElement(ChannelsListView, {
        items,
        filteredItems: items,
        totals: summarizeInventoryTotals(items),
        filter: "all" as ChannelFilter,
        filterCounts: buildFilterCounts(items),
        availableFilters: ["all", "enabled", "alerts"] as ChannelFilter[],
        searchQuery: "",
        searchInputRef: createRef<HTMLInputElement | null>(),
        loadState: "ready",
        error: "",
        selectedChannelId: items[0].id,
        payloadTimestamp: 1234,
        t,
        onSearchChange: () => undefined,
        onFilterChange: () => undefined,
        onClearFilters: () => undefined,
        onRefresh: () => undefined,
        onSelect,
      }),
    );
    expect(container.querySelector(".list-view")).toBeTruthy();
    expect(container.querySelector(".kpi-strip")).toBeTruthy();
    expect(container.querySelector(".toolbar__search")).toBeTruthy();
    expect(container.querySelector(".row__head")).toBeTruthy();
    expect(buttonByText("newChannel")?.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>(".row"))
        .find((button) => button.textContent?.includes("Telegram"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith("telegram");
  });

  it("forwards search and filter changes through props", async () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    const onSearchChange = vi.fn();
    const onFilterChange = vi.fn();
    await render(
      createElement(ChannelsListView, {
        items,
        filteredItems: items,
        totals: summarizeInventoryTotals(items),
        filter: "all" as ChannelFilter,
        filterCounts: buildFilterCounts(items),
        availableFilters: ["all", "enabled", "alerts"] as ChannelFilter[],
        searchQuery: "",
        searchInputRef: createRef<HTMLInputElement | null>(),
        loadState: "ready",
        error: "",
        selectedChannelId: items[0].id,
        payloadTimestamp: 1234,
        t,
        onSearchChange,
        onFilterChange,
        onClearFilters: () => undefined,
        onRefresh: () => undefined,
        onSelect: () => undefined,
      }),
    );
    const searchInput = container.querySelector<HTMLInputElement>(".toolbar__search input");
    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "discord" } });
    });
    expect(onSearchChange).toHaveBeenCalledWith("discord");

    await act(async () => {
      buttonByText("filter_enabled")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onFilterChange).toHaveBeenCalledWith("enabled");
  });

  it("renders true-empty state for empty payload", async () => {
    const items = buildChannelInventory(emptyChannelsFixture(), t);
    await render(
      createElement(ChannelsListView, {
        items,
        filteredItems: items,
        totals: summarizeInventoryTotals(items),
        filter: "all" as ChannelFilter,
        filterCounts: buildFilterCounts(items),
        availableFilters: ["all", "enabled", "alerts"] as ChannelFilter[],
        searchQuery: "",
        searchInputRef: createRef<HTMLInputElement | null>(),
        loadState: "ready",
        error: "",
        selectedChannelId: undefined,
        payloadTimestamp: 9_999,
        t,
        onSearchChange: () => undefined,
        onFilterChange: () => undefined,
        onClearFilters: () => undefined,
        onRefresh: () => undefined,
        onSelect: () => undefined,
      }),
    );
    expect(container.textContent).toContain("noChannelsLoaded");
    expect(container.textContent).toContain("noChannelsLoadedDescription");
  });

  it("renders filtered-empty state with clear-filters recovery", async () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    const onClearFilters = vi.fn();
    await render(
      createElement(ChannelsListView, {
        items,
        filteredItems: [],
        totals: summarizeInventoryTotals(items),
        filter: "alerts" as ChannelFilter,
        filterCounts: buildFilterCounts(items),
        availableFilters: ["all", "enabled", "alerts"] as ChannelFilter[],
        searchQuery: "ghost",
        searchInputRef: createRef<HTMLInputElement | null>(),
        loadState: "ready",
        error: "",
        selectedChannelId: items[0].id,
        payloadTimestamp: 1234,
        t,
        onSearchChange: () => undefined,
        onFilterChange: () => undefined,
        onClearFilters,
        onRefresh: () => undefined,
        onSelect: () => undefined,
      }),
    );
    expect(container.textContent).toContain("noFilteredChannels");
    expect(container.textContent).toContain("criteriaSearch{value=ghost}");
    expect(container.textContent).toContain("criteriaFilter{value=filter_alerts}");
    await act(async () => {
      buttonByText("clearFilters")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClearFilters).toHaveBeenCalled();
  });

  it("renders error state with refresh button", async () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    const onRefresh = vi.fn();
    await render(
      createElement(ChannelsListView, {
        items,
        filteredItems: items,
        totals: summarizeInventoryTotals(items),
        filter: "all" as ChannelFilter,
        filterCounts: buildFilterCounts(items),
        availableFilters: ["all", "enabled", "alerts"] as ChannelFilter[],
        searchQuery: "",
        searchInputRef: createRef<HTMLInputElement | null>(),
        loadState: "ready",
        error: "boom",
        selectedChannelId: items[0].id,
        payloadTimestamp: 1234,
        t,
        onSearchChange: () => undefined,
        onFilterChange: () => undefined,
        onClearFilters: () => undefined,
        onRefresh,
        onSelect: () => undefined,
      }),
    );
    expect(container.textContent).toContain("loadChannelsFailed");
    expect(container.textContent).toContain("boom");
    await act(async () => {
      buttonByText("refreshChannels")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRefresh).toHaveBeenCalled();
  });

  it("renders loading state", async () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    await render(
      createElement(ChannelsListView, {
        items,
        filteredItems: items,
        totals: summarizeInventoryTotals(items),
        filter: "all" as ChannelFilter,
        filterCounts: buildFilterCounts(items),
        availableFilters: ["all", "enabled", "alerts"] as ChannelFilter[],
        searchQuery: "",
        searchInputRef: createRef<HTMLInputElement | null>(),
        loadState: "loading",
        error: "",
        selectedChannelId: items[0].id,
        payloadTimestamp: undefined,
        t,
        onSearchChange: () => undefined,
        onFilterChange: () => undefined,
        onClearFilters: () => undefined,
        onRefresh: () => undefined,
        onSelect: () => undefined,
      }),
    );
    expect(container.textContent).toContain("loadingChannels");
  });
});
