import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { ChevronDownIcon, ChevronUpIcon, LoaderIcon } from "../../../deck-ui/icons";
import { useTranslations } from "../../../i18n/provider";

type ButtonPaginationProps = {
  mode: "button";
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
};

type InfinitePaginationProps = {
  hasMore: boolean;
  mode: "infinite";
  onLoadMore: () => void;
  scrollRoot?: RefObject<HTMLElement | null>;
};

export type PaginatedListProps = {
  children?: ReactNode;
  loading?: boolean;
  skeletonCount?: number;
  totalCount?: number;
} & (ButtonPaginationProps | InfinitePaginationProps);

export function PaginatedList(props: PaginatedListProps) {
  const t = useTranslations("lists");
  const { children, loading = false, totalCount } = props;

  return (
    <div className="deckgo-paginated-list">
      {totalCount != null ? (
        <div className="deckgo-paginated-count">{t("totalCount", { count: totalCount })}</div>
      ) : null}
      <div className="deckgo-paginated-content">{children}</div>
      {loading && props.mode === "button" ? (
        <ButtonModeLoading count={Math.min(props.skeletonCount ?? 3, 5)} />
      ) : null}
      {props.mode === "button" && !loading && props.totalPages > 1 ? (
        <ButtonPagination
          onPageChange={props.onPageChange}
          page={props.page}
          totalPages={props.totalPages}
        />
      ) : null}
      {props.mode === "infinite" ? (
        <InfiniteSentinel
          hasMore={props.hasMore}
          loading={loading}
          onLoadMore={props.onLoadMore}
          scrollRoot={props.scrollRoot}
        />
      ) : null}
    </div>
  );
}

function ButtonPagination(props: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  const t = useTranslations("lists");
  const { onPageChange, page, totalPages } = props;
  return (
    <div className="deckgo-pagination" role="navigation">
      <button
        aria-disabled={page <= 1}
        className="deckgo-icon-button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        <ChevronUpIcon />
      </button>
      <span>{t("pageInfo", { current: page, total: totalPages })}</span>
      <button
        aria-disabled={page >= totalPages}
        className="deckgo-icon-button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        <ChevronDownIcon />
      </button>
    </div>
  );
}

function InfiniteSentinel(props: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  scrollRoot?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("lists");
  const { hasMore, loading, onLoadMore, scrollRoot } = props;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) {
      return undefined;
    }
    const element = sentinelRef.current;
    if (!element) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: scrollRoot?.current ?? null, threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, scrollRoot]);

  if (!hasMore && !loading) {
    return <div className="deckgo-paginated-end">{t("noMoreData")}</div>;
  }

  return (
    <div className="deckgo-paginated-sentinel" ref={sentinelRef}>
      {loading ? <LoaderIcon /> : null}
    </div>
  );
}

function ButtonModeLoading(props: { count: number }) {
  return (
    <div className="deckgo-paginated-loading">
      {Array.from({ length: props.count }, (_, index) => (
        <div className="deckgo-skeleton" key={index} />
      ))}
    </div>
  );
}
