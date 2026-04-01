"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ScopeStrategyCardProps {
  mode: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function ScopeDiagram({ mode }: { mode: string }) {
  const box = "rounded-sm bg-[var(--primary)]/20 border border-[var(--primary)]/40";
  const boxSm = cn(box, "w-5 h-5");
  const label = "text-[8px] text-[var(--muted-foreground)] leading-none";

  switch (mode) {
    case "main":
      return (
        <div className="flex items-center justify-center h-12">
          <div className={cn(box, "w-14 h-10 flex items-center justify-center")}>
            <span className={label}>main</span>
          </div>
        </div>
      );
    case "per-peer":
      return (
        <div className="flex items-center justify-center gap-1.5 h-12">
          <div className={cn(boxSm, "flex items-center justify-center")}>
            <span className={label}>A</span>
          </div>
          <div className={cn(boxSm, "flex items-center justify-center")}>
            <span className={label}>B</span>
          </div>
          <div className={cn(boxSm, "flex items-center justify-center")}>
            <span className={label}>C</span>
          </div>
        </div>
      );
    case "per-channel-peer":
      return (
        <div className="flex flex-col items-center justify-center gap-1 h-12">
          <div className="flex items-center gap-1">
            <span className={cn(label, "w-6 text-right")}>#1</span>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>A</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>B</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>C</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn(label, "w-6 text-right")}>#2</span>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>A</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>B</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>C</span>
            </div>
          </div>
        </div>
      );
    case "per-account-channel-peer":
      return (
        <div className="flex flex-col items-center justify-center gap-1 h-12">
          <div className="flex items-center gap-1">
            <span className={cn(label, "w-8 text-right truncate")}>acct</span>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>A</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>B</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>C</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn(label, "w-8 text-right truncate")}>#1</span>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>A</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>B</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>C</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn(label, "w-8 text-right truncate")}>#2</span>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>A</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>B</span>
            </div>
            <div className={cn(boxSm, "flex items-center justify-center")}>
              <span className={label}>C</span>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function ScopeStrategyCard({
  mode,
  title,
  description,
  selected,
  onClick,
}: ScopeStrategyCardProps) {
  const t = useTranslations("sessions");
  void t; // available for future i18n within card

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-lg p-3 text-left transition-all cursor-pointer",
        "ring-1 hover:ring-[var(--primary)]/50",
        selected
          ? "ring-2 ring-[var(--primary)] bg-[var(--primary)]/5"
          : "ring-[var(--border)] bg-[var(--background)]",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--foreground)]">{title}</span>
        {selected && (
          <span className="text-[10px] font-medium text-[var(--primary)]">{t("scopeCurrent")}</span>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">{description}</p>
      <ScopeDiagram mode={mode} />
    </button>
  );
}
