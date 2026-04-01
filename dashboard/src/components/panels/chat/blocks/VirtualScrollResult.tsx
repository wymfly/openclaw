"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Maximize2, Minimize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// VirtualScrollResult — virtualized line-numbered view for large text output.
//
// Splits content into lines and renders them with line numbers using
// @tanstack/react-virtual for efficient scrolling. Supports expand/collapse
// between 400px (default) and 80vh heights.
// ---------------------------------------------------------------------------

const COLLAPSED_HEIGHT = 400;
const LINE_HEIGHT = 20;
const OVERSCAN = 20;

interface VirtualScrollResultProps {
  content: string;
}

export function VirtualScrollResult({ content }: VirtualScrollResultProps) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => content.split("\n"), [content]);
  const gutterWidth = String(lines.length).length;

  // SSR guard: use a safe fallback for window.innerHeight
  const expandedHeight = typeof window !== "undefined" ? window.innerHeight * 0.8 : 800;

  const containerHeight = expanded ? expandedHeight : COLLAPSED_HEIGHT;

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Visible line range for the header indicator
  const rangeStart = virtualItems.length > 0 ? virtualItems[0].index + 1 : 0;
  const rangeEnd = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index + 1 : 0;

  return (
    <div className="my-1.5 rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-[var(--muted)] border-b border-[var(--border-subtle)]">
        <span className="text-[10px] font-medium text-[var(--muted-foreground)]">
          {t("virtualLines", {
            start: rangeStart,
            end: rangeEnd,
            total: lines.length.toLocaleString(),
          })}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors cursor-pointer"
        >
          {expanded ? (
            <>
              <Minimize2 size={10} />
              {t("virtualCollapse")}
            </>
          ) : (
            <>
              <Maximize2 size={10} />
              {t("virtualExpand")}
            </>
          )}
        </button>
      </div>

      {/* Virtualized content area */}
      <div
        ref={parentRef}
        className="overflow-auto bg-[var(--background)]"
        style={{ height: containerHeight }}
      >
        <div className="w-full relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualItems.map((virtualRow) => (
            <div
              key={virtualRow.index}
              className="absolute left-0 w-full flex text-xs font-mono hover:bg-[var(--muted)] transition-colors"
              style={{
                height: LINE_HEIGHT,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* Line number gutter */}
              <span
                className="shrink-0 px-2 text-right select-none text-[var(--text-tertiary)] border-r border-[var(--border-subtle)] bg-[var(--card)] leading-5"
                style={{ minWidth: `${gutterWidth + 2}ch` }}
              >
                {virtualRow.index + 1}
              </span>
              {/* Line content */}
              <span className="px-3 text-[var(--foreground)] whitespace-pre overflow-hidden text-ellipsis leading-5">
                {lines[virtualRow.index] || "\u00A0"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
