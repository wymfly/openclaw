"use client";

import { Search, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { PanelError } from "@/components/ui/panel-error";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { useApiExplorerStore, groupMethodsByDomain, type MethodInfo } from "@/stores/api-explorer";
import { EventList } from "./EventList";
import { MethodDetail } from "./MethodDetail";

type Tab = "methods" | "events";

export default function ApiExplorerPanel() {
  const t = useTranslations("apiExplorer");
  const {
    methods,
    events,
    search,
    selectedMethod,
    loading,
    error,
    fetchDescribe,
    setSearch,
    setSelectedMethod,
  } = useApiExplorerStore();

  const [tab, setTab] = useState<Tab>("methods");

  useEffect(() => {
    if (methods.length === 0 && !loading && !error) {
      void fetchDescribe();
    }
  }, [methods.length, loading, error, fetchDescribe]);

  const filtered = useMemo(() => {
    if (!search.trim()) {
      return methods;
    }
    const q = search.toLowerCase();
    return methods.filter(
      (m) => m.name.toLowerCase().includes(q) || m.scope.toLowerCase().includes(q),
    );
  }, [methods, search]);

  const grouped = useMemo(() => groupMethodsByDomain(filtered), [filtered]);

  const selected = useMemo(
    () => methods.find((m) => m.name === selectedMethod),
    [methods, selectedMethod],
  );

  if (loading) {
    return <PanelSkeleton variant="list" />;
  }
  if (error) {
    return <PanelError error={error} onRetry={fetchDescribe} />;
  }
  if (methods.length === 0) {
    return (
      <PanelEmptyState
        icon={<Zap size={40} strokeWidth={1.2} />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        <button
          type="button"
          onClick={() => setTab("methods")}
          className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          style={{
            backgroundColor: tab === "methods" ? "var(--accent)" : "transparent",
            color: tab === "methods" ? "var(--foreground)" : "var(--muted-foreground)",
          }}
        >
          {t("methodsTab")} ({methods.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("events")}
          className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          style={{
            backgroundColor: tab === "events" ? "var(--accent)" : "transparent",
            color: tab === "events" ? "var(--foreground)" : "var(--muted-foreground)",
          }}
        >
          {t("eventsTab")} ({events.length})
        </button>
      </div>

      {tab === "methods" ? (
        <div className="flex flex-1 min-h-0">
          {/* Left: method list */}
          <div
            className="w-[280px] shrink-0 border-r flex flex-col"
            style={{ borderColor: "var(--border)" }}
          >
            {/* Search */}
            <div className="p-2">
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}
              >
                <Search size={14} className="text-[var(--muted-foreground)] shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="flex-1 bg-transparent outline-none text-xs"
                  style={{ color: "var(--foreground)" }}
                />
              </div>
            </div>

            {/* Grouped list */}
            <div className="flex-1 overflow-y-auto">
              {Object.entries(grouped).map(([domain, items]) => (
                <div key={domain}>
                  <div
                    className="sticky top-0 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
                  >
                    {domain} ({items.length})
                  </div>
                  {items.map((m) => (
                    <MethodListItem
                      key={m.name}
                      method={m}
                      isSelected={m.name === selectedMethod}
                      onSelect={() => setSelectedMethod(m.name)}
                    />
                  ))}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="p-4 text-xs text-[var(--muted-foreground)] text-center">
                  {t("noResults")}
                </p>
              )}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <MethodDetail method={selected} />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-[var(--muted-foreground)]">
                {t("selectMethod")}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <EventList events={events} />
        </div>
      )}
    </div>
  );
}

function MethodListItem({
  method,
  isSelected,
  onSelect,
}: {
  method: MethodInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--accent)]"
      style={{
        backgroundColor: isSelected ? "var(--accent)" : undefined,
        color: "var(--foreground)",
      }}
    >
      <span className="font-mono">{method.name}</span>
    </button>
  );
}
