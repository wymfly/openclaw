"use client";

import { useTranslations } from "next-intl";
import type { DiffEntry } from "@/lib/config-diff";
import { ConfigValueRenderer } from "./ConfigValueRenderer";

const DIFF_COLORS: Record<DiffEntry["type"], string> = {
  add: "var(--success-muted)",
  change: "var(--warning-muted)",
  remove: "var(--destructive-muted)",
};

const DIFF_TEXT_COLORS: Record<DiffEntry["type"], string> = {
  add: "var(--success-muted-text)",
  change: "var(--warning-muted-text)",
  remove: "var(--destructive-muted-text)",
};

interface DiffSectionProps {
  diffs: DiffEntry[];
}

export function DiffSection({ diffs }: DiffSectionProps) {
  const t = useTranslations("agentCompare");

  // Group diffs by top-level key
  const grouped = new Map<string, DiffEntry[]>();
  for (const d of diffs) {
    const topKey = d.path.split(".")[0];
    const group = grouped.get(topKey) ?? [];
    group.push(d);
    grouped.set(topKey, group);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted-foreground)]">
        {t("diffCount", { count: diffs.length })}
      </p>
      {[...grouped.entries()].map(([section, entries]) => (
        <div
          key={section}
          className="rounded-md border overflow-hidden"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div
            className="px-3 py-1.5 text-[11px] font-medium"
            style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
          >
            {section}
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {entries.map((d) => (
              <DiffRow key={d.path} entry={d} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffRow({ entry }: { entry: DiffEntry }) {
  const t = useTranslations("agentCompare");
  const bg = DIFF_COLORS[entry.type];
  const textColor = DIFF_TEXT_COLORS[entry.type];

  return (
    <div className="flex items-start gap-3 px-3 py-2" style={{ backgroundColor: bg }}>
      <span
        className="text-[10px] font-mono font-medium uppercase shrink-0 mt-0.5"
        style={{ color: textColor }}
      >
        {entry.type === "add" ? "+" : entry.type === "remove" ? "−" : "~"}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-mono" style={{ color: "var(--foreground)" }}>
          {entry.path}
        </span>
        <div className="flex gap-4 mt-1">
          {entry.type !== "add" && (
            <div className="flex-1 min-w-0">
              <span className="text-[9px] text-[var(--text-tertiary)] block mb-0.5">
                {t("oldValue")}
              </span>
              <ConfigValueRenderer value={entry.oldValue} />
            </div>
          )}
          {entry.type !== "remove" && (
            <div className="flex-1 min-w-0">
              <span className="text-[9px] text-[var(--text-tertiary)] block mb-0.5">
                {t("newValue")}
              </span>
              <ConfigValueRenderer value={entry.newValue} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
