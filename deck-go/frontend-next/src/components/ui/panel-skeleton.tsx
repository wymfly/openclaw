import { Skeleton } from "./skeleton";

type SkeletonVariant = "list" | "cards" | "table" | "detail";

interface PanelSkeletonProps {
  variant?: SkeletonVariant;
}

function ListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: "var(--border)" }}
        >
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 space-y-2">
      <Skeleton className="h-8 w-full rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded" />
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-8 w-full rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-8 w-full rounded" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded" />
    </div>
  );
}

const VARIANT_MAP: Record<SkeletonVariant, () => React.ReactNode> = {
  list: ListSkeleton,
  cards: CardsSkeleton,
  table: TableSkeleton,
  detail: DetailSkeleton,
};

export function PanelSkeleton({ variant = "list" }: PanelSkeletonProps) {
  const Comp = VARIANT_MAP[variant];
  return <Comp />;
}
