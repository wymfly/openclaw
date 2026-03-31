"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { VirtualRenderItemProps } from "./types";

interface VirtualListProps<T> {
  /** Data array to render. */
  data: T[];
  /** Estimated row height in pixels. Constant = fixed height; variable = dynamic. */
  estimateSize: (index: number) => number;
  /** Number of extra rows to render outside visible area. Default: 5. */
  overscan?: number;
  /** Render function for each visible item. */
  renderItem: (props: VirtualRenderItemProps<T>) => React.ReactNode;
  /** Custom empty state. Falls back to i18n default. */
  emptyState?: React.ReactNode;
  /** Session key for scroll position restoration. Omit to disable. */
  scrollRestorationKey?: string;
  /** Container height. Default: "100%". */
  height?: number | string;
  /** Optional className for the outer scroll container. */
  className?: string;
}

const SCROLL_STORAGE_PREFIX = "vlist-scroll-";

export function VirtualList<T>({
  data,
  estimateSize,
  overscan = 5,
  renderItem,
  emptyState,
  scrollRestorationKey,
  height = "100%",
  className,
}: VirtualListProps<T>) {
  const t = useTranslations("lists");
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // ----- Scroll restoration: save -----
  useEffect(() => {
    if (!scrollRestorationKey) return;
    const el = parentRef.current;
    if (!el) return;

    const handleScroll = () => {
      try {
        sessionStorage.setItem(
          SCROLL_STORAGE_PREFIX + scrollRestorationKey,
          String(el.scrollTop),
        );
      } catch {
        // sessionStorage full or unavailable — ignore
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollRestorationKey]);

  // ----- Scroll restoration: restore -----
  useEffect(() => {
    if (!scrollRestorationKey) return;
    const el = parentRef.current;
    if (!el) return;

    try {
      const saved = sessionStorage.getItem(SCROLL_STORAGE_PREFIX + scrollRestorationKey);
      if (saved) {
        el.scrollTop = Number(saved);
      }
    } catch {
      // ignore
    }
  }, [scrollRestorationKey]);

  // ----- Empty state -----
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-12 text-sm text-muted-foreground"
        style={{ height }}
      >
        {emptyState ?? t("empty")}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={className}
      style={{
        height,
        overflow: "auto",
        position: "relative",
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem({
              item: data[virtualRow.index],
              index: virtualRow.index,
              virtualRow: {
                start: virtualRow.start,
                size: virtualRow.size,
                index: virtualRow.index,
              },
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
