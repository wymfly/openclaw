// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { SessionKeyDisplay } from "../SessionKeyDisplay";
import { BatchActionBar } from "./BatchActionBar";
import { InlineEdit } from "./InlineEdit";
import { ListSearchBar } from "./ListSearchBar";
import { PaginatedList } from "./PaginatedList";
import { SortableHeader } from "./SortableHeader";
import { useListState } from "./useListState";

let container: HTMLDivElement;
let root: Root | null = null;

function renderWithLocale(node: React.ReactNode, locale: "en" | "zh" = "en") {
  act(() => {
    root = createRoot(container);
    root.render(createElement(DeckIntlProvider, { locale }, node));
  });
}

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
  vi.useRealTimers();
});

type ListItem = {
  id: string;
  name: string;
  tone: "cool" | "warm";
};

function ListStateHarness() {
  const state = useListState<ListItem>({
    data: [
      { id: "a", name: "Beta", tone: "cool" },
      { id: "b", name: "Alpha", tone: "warm" },
      { id: "c", name: "Gamma", tone: "warm" },
    ],
    filterFn: (item, filters) => !filters.tone || item.tone === filters.tone,
    pageSize: 2,
  });

  return (
    <div>
      <output data-testid="rows">{state.paginatedData.map((item) => item.name).join(",")}</output>
      <output data-testid="selection">{state.selectedIds.size}</output>
      <button onClick={() => state.setSort({ direction: "asc", key: "name" })} type="button">
        sort
      </button>
      <button onClick={() => state.setFilters({ tone: "warm" })} type="button">
        filter
      </button>
      <button onClick={() => state.selectAll()} type="button">
        select
      </button>
    </div>
  );
}

function SortHeaderHarness() {
  const [sort, setSort] = useState<{ direction: "asc" | "desc"; key: string } | null>(null);
  return (
    <div>
      <SortableHeader columnKey="name" sort={sort} onSortChange={setSort}>
        Name
      </SortableHeader>
      <output data-testid="sort">{sort ? `${sort.key}:${sort.direction}` : "none"}</output>
    </div>
  );
}

describe("shared list primitives", () => {
  it("manages filter, sort, pagination, and selection state", () => {
    renderWithLocale(createElement(ListStateHarness));

    expect(container.querySelector('[data-testid="rows"]')?.textContent).toBe("Beta,Alpha");
    act(() => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });
    expect(container.querySelector('[data-testid="rows"]')?.textContent).toBe("Alpha,Beta");
    act(() => {
      container.querySelectorAll<HTMLButtonElement>("button")[2]?.click();
    });
    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe("3");
    act(() => {
      container.querySelectorAll<HTMLButtonElement>("button")[1]?.click();
    });
    expect(container.querySelector('[data-testid="rows"]')?.textContent).toBe("Alpha,Gamma");
    expect(container.querySelector('[data-testid="selection"]')?.textContent).toBe("0");
  });

  it("renders localized search/filter and debounces search input", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const onFilterChange = vi.fn();
    renderWithLocale(
      createElement(ListSearchBar, {
        debounceMs: 25,
        filterValues: {},
        filters: [
          {
            key: "tone",
            label: "Tone",
            options: [{ label: "Warm", value: "warm" }],
            type: "select",
          },
        ],
        matchCount: 1,
        onFilterChange,
        onSearch,
      }),
      "zh",
    );

    const input = container.querySelector<HTMLInputElement>("input");
    expect(input?.getAttribute("placeholder")).toBe("搜索...");
    act(() => {
      vi.advanceTimersByTime(25);
    });
    onSearch.mockClear();
    act(() => {
      if (input) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        valueSetter?.call(input, "agent");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    act(() => {
      vi.advanceTimersByTime(25);
    });
    expect(onSearch).toHaveBeenCalledWith("agent");

    act(() => {
      container.querySelector<HTMLButtonElement>('[aria-label="高级过滤"]')?.click();
    });
    const select = container.querySelector<HTMLSelectElement>("select");
    act(() => {
      if (select) {
        select.value = "warm";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onFilterChange).toHaveBeenCalledWith({ tone: "warm" });
  });

  it("renders localized batch selection controls", () => {
    const onClearSelection = vi.fn();
    renderWithLocale(
      createElement(BatchActionBar, {
        isAllSelected: false,
        isPartialSelected: true,
        onClearSelection,
        onSelectAll: vi.fn(),
        selectedIds: new Set(["a", "b"]),
      }),
      "zh",
    );

    expect(container.textContent).toContain("已选 2 项");
    act(() => {
      container.querySelector<HTMLButtonElement>('[aria-label="取消选择"]')?.click();
    });
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("supports old Deck inline edit and sortable header cycles", () => {
    const onConfirm = vi.fn();
    renderWithLocale(
      createElement(
        "div",
        null,
        createElement(InlineEdit, {
          onConfirm,
          options: [
            { label: "Alpha", value: "a" },
            { label: "Beta", value: "b" },
          ],
          type: "select",
          value: "a",
        }),
        createElement(SortHeaderHarness),
      ),
    );

    act(() => {
      container.querySelector<HTMLButtonElement>(".deckgo-inline-edit")?.click();
    });
    const select = container.querySelector<HTMLSelectElement>("select");
    act(() => {
      if (select) {
        select.value = "b";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onConfirm).toHaveBeenCalledWith("b");

    const sortButton = container.querySelector<HTMLButtonElement>(".deckgo-sortable-header");
    act(() => {
      sortButton?.click();
    });
    expect(container.querySelector('[data-testid="sort"]')?.textContent).toBe("name:asc");
    act(() => {
      sortButton?.click();
    });
    expect(container.querySelector('[data-testid="sort"]')?.textContent).toBe("name:desc");
  });

  it("renders localized pagination copy", () => {
    renderWithLocale(
      createElement(
        PaginatedList,
        { mode: "button", onPageChange: vi.fn(), page: 1, totalCount: 8, totalPages: 2 },
        createElement("div", null, "rows"),
      ),
      "zh",
    );

    expect(container.textContent).toContain("共 8 项");
    expect(container.textContent).toContain("第 1 / 2 页");
  });

  it("renders colon-delimited session keys as readable segments", () => {
    renderWithLocale(createElement(SessionKeyDisplay, { sessionKey: "main:chat:local" }));

    expect(container.textContent).toBe("main:chat:local");
    expect(container.querySelectorAll(".deckgo-session-key-separator")).toHaveLength(2);
  });
});
