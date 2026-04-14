"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { useUsageStore, type ContextWeightReport } from "@/stores/usage";

function formatChars(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

function BarSegment({ pct, color, label }: { pct: number; color: string; label: string }) {
  if (pct < 1) {
    return null;
  }
  return (
    <div
      className="h-full transition-all duration-300"
      style={{ width: `${pct}%`, backgroundColor: color }}
      title={`${label}: ${pct.toFixed(1)}%`}
    />
  );
}

function CategoryList({
  items,
  renderItem,
}: {
  items: Array<{ name: string }>;
  renderItem: (item: Record<string, unknown>, i: number) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) {
    return null;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] transition-colors"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {items.length}
      </button>
      {expanded && (
        <div className="ml-3 mt-1 space-y-0.5">
          {items.map((item, i) => renderItem(item as Record<string, unknown>, i))}
        </div>
      )}
    </div>
  );
}

function BreakdownContent({
  report,
  contextWindow,
}: {
  report: ContextWeightReport;
  contextWindow: number;
}) {
  const t = useTranslations("sessions");

  const systemChars = report.systemPrompt.chars;
  const toolsChars = report.tools.listChars + report.tools.schemaChars;
  const skillsChars = report.skills.promptChars;
  const filesChars =
    report.injectedWorkspaceFiles?.reduce((sum, f) => sum + f.injectedChars, 0) ?? 0;
  const totalChars = systemChars + toolsChars + skillsChars + filesChars;

  const pctOf = (n: number) => (totalChars > 0 ? (n / totalChars) * 100 : 0);

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-2 rounded-full overflow-hidden flex bg-[var(--muted)]">
        <BarSegment
          pct={pctOf(systemChars)}
          color="var(--primary)"
          label={t("contextWeight.systemPrompt")}
        />
        <BarSegment
          pct={pctOf(toolsChars)}
          color="var(--warning)"
          label={t("contextWeight.tools")}
        />
        <BarSegment
          pct={pctOf(skillsChars)}
          color="var(--purple)"
          label={t("contextWeight.skills")}
        />
        <BarSegment
          pct={pctOf(filesChars)}
          color="var(--success)"
          label={t("contextWeight.files")}
        />
      </div>

      {/* Legend + details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {/* System prompt */}
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            <span className="text-[var(--muted-foreground)]">
              {t("contextWeight.systemPrompt")}
            </span>
          </div>
          <span className="font-mono font-semibold text-[var(--foreground)] ml-3.5">
            {formatChars(systemChars)}
          </span>
        </div>

        {/* Tools */}
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
            <span className="text-[var(--muted-foreground)]">{t("contextWeight.tools")}</span>
          </div>
          <span className="font-mono font-semibold text-[var(--foreground)] ml-3.5">
            {formatChars(toolsChars)}
          </span>
          <CategoryList
            items={report.tools.entries}
            renderItem={(item, i) => (
              <div
                key={i}
                className="flex justify-between text-[10px] text-[var(--muted-foreground)]"
              >
                <span className="font-mono truncate">{String(item.name)}</span>
                <span className="font-mono shrink-0 ml-2">
                  {formatChars(Number(item.schemaChars ?? 0))}
                </span>
              </div>
            )}
          />
        </div>

        {/* Skills */}
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--purple)]" />
            <span className="text-[var(--muted-foreground)]">{t("contextWeight.skills")}</span>
          </div>
          <span className="font-mono font-semibold text-[var(--foreground)] ml-3.5">
            {formatChars(skillsChars)}
          </span>
          <CategoryList
            items={report.skills.entries}
            renderItem={(item, i) => (
              <div
                key={i}
                className="flex justify-between text-[10px] text-[var(--muted-foreground)]"
              >
                <span className="font-mono truncate">{String(item.name)}</span>
                <span className="font-mono shrink-0 ml-2">
                  {formatChars(Number(item.blockChars ?? 0))}
                </span>
              </div>
            )}
          />
        </div>

        {/* Files */}
        {report.injectedWorkspaceFiles && report.injectedWorkspaceFiles.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
              <span className="text-[var(--muted-foreground)]">{t("contextWeight.files")}</span>
            </div>
            <span className="font-mono font-semibold text-[var(--foreground)] ml-3.5">
              {formatChars(filesChars)}
            </span>
            <CategoryList
              items={report.injectedWorkspaceFiles}
              renderItem={(item, i) => (
                <div
                  key={i}
                  className="flex justify-between text-[10px] text-[var(--muted-foreground)]"
                >
                  <span className="font-mono truncate">{String(item.name)}</span>
                  <span className="font-mono shrink-0 ml-2">
                    {formatChars(Number(item.injectedChars ?? 0))}
                    {item.truncated === true && " ✂"}
                  </span>
                </div>
              )}
            />
          </div>
        )}
      </div>

      {/* Total */}
      {contextWindow > 0 && (
        <div className="text-[10px] text-[var(--muted-foreground)] text-right">
          {formatChars(totalChars)} ({((totalChars / contextWindow) * 100).toFixed(1)}%)
        </div>
      )}
    </div>
  );
}

export function ContextWeightBreakdown({
  sessionKey,
  contextWindow,
}: {
  sessionKey: string;
  contextWindow: number;
}) {
  const t = useTranslations("sessions");
  const report = useUsageStore((s) => s.contextWeightCache[sessionKey]);
  const loading = useUsageStore((s) => s.contextWeightLoading);
  const error = useUsageStore((s) => s.contextWeightError);
  const fetchContextWeight = useUsageStore((s) => s.fetchContextWeight);
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && !report) {
      void fetchContextWeight(sessionKey);
    }
  }, [open, report, fetchContextWeight, sessionKey]);

  return (
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "w-full px-4 py-2 flex items-center gap-2 text-xs cursor-pointer",
          "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50 transition-colors",
        )}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {t("contextWeight.title")}
      </button>
      {open && (
        <div className="px-4 pb-3">
          {loading && !report && (
            <p className="text-xs text-[var(--muted-foreground)]">{t("contextWeight.loading")}</p>
          )}
          {error && error !== "empty" && !report && (
            <p className="text-xs text-[var(--destructive)]">{t("contextWeight.error")}</p>
          )}
          {error === "empty" && !report && (
            <p className="text-xs text-[var(--muted-foreground)]">{t("contextWeight.empty")}</p>
          )}
          {report && <BreakdownContent report={report} contextWindow={contextWindow} />}
        </div>
      )}
    </div>
  );
}
