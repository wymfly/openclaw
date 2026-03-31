"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginatedListButtonProps {
  mode: "button";
  /** Current page (1-indexed). */
  page: number;
  /** Total pages. */
  totalPages: number;
  /** Called when user clicks a page button. */
  onPageChange: (page: number) => void;
}

interface PaginatedListInfiniteProps {
  mode: "infinite";
  /** Whether more data is available. */
  hasMore: boolean;
  /** Called when sentinel enters viewport. */
  onLoadMore: () => void;
  /** Optional scroll root ref for IntersectionObserver. */
  scrollRoot?: React.RefObject<HTMLElement | null>;
}

type PaginatedListProps = {
  /** Content to render (the actual list items). */
  children: React.ReactNode;
  /** Whether data is loading. */
  loading?: boolean;
  /** Total item count for display. */
  totalCount?: number;
  /** Number of skeleton rows in button mode loading. Default: 3, max: 5. */
  skeletonCount?: number;
} & (PaginatedListButtonProps | PaginatedListInfiniteProps);

export function PaginatedList(props: PaginatedListProps) {
  const t = useTranslations("lists");
  const { children, loading = false, totalCount } = props;

  return (
    <div className="flex flex-col gap-2">
      {/* Total count */}
      {totalCount != null && (
        <div className="text-xs text-muted-foreground px-1">
          {t("totalCount", { count: totalCount })}
        </div>
      )}

      {/* List content */}
      <div className="min-h-0 flex-1">{children}</div>

      {/* Loading state */}
      {loading && props.mode === "button" && (
        <ButtonModeLoading count={Math.min(props.skeletonCount ?? 3, 5)} />
      )}

      {/* Button pagination */}
      {props.mode === "button" && !loading && props.totalPages > 1 && (
        <ButtonPagination
          page={props.page}
          totalPages={props.totalPages}
          onPageChange={props.onPageChange}
        />
      )}

      {/* Infinite scroll sentinel */}
      {props.mode === "infinite" && (
        <InfiniteSentinel
          hasMore={props.hasMore}
          loading={loading}
          onLoadMore={props.onLoadMore}
          scrollRoot={props.scrollRoot}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button pagination sub-component
// ---------------------------------------------------------------------------

function ButtonPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  // Show up to 5 page numbers centered around current page
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={(e) => {
              e.preventDefault();
              if (page > 1) onPageChange(page - 1);
            }}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
        {pages.map((p) => (
          <PaginationItem key={p}>
            <PaginationLink
              onClick={(e) => {
                e.preventDefault();
                onPageChange(p);
              }}
              isActive={p === page}
              className="cursor-pointer"
            >
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            onClick={(e) => {
              e.preventDefault();
              if (page < totalPages) onPageChange(page + 1);
            }}
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

// ---------------------------------------------------------------------------
// Infinite scroll sentinel sub-component
// ---------------------------------------------------------------------------

function InfiniteSentinel({
  hasMore,
  loading,
  onLoadMore,
  scrollRoot,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("lists");
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: scrollRoot?.current ?? null, threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, scrollRoot]);

  if (!hasMore && !loading) {
    return (
      <div className="text-center py-3 text-xs text-muted-foreground">{t("noMoreData")}</div>
    );
  }

  return (
    <div ref={sentinelRef} className="flex items-center justify-center py-3">
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading rows
// ---------------------------------------------------------------------------

function ButtonModeLoading({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}
