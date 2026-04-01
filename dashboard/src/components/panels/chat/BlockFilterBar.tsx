"use client";

import { Brain, Wrench, ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";

interface BlockFilterBarProps {
  preferences: ChatBlockPreferences;
  onChange: (prefs: ChatBlockPreferences) => void;
}

export function BlockFilterBar({ preferences, onChange }: BlockFilterBarProps) {
  const t = useTranslations("chat");

  const toggles = [
    { key: "showThinking" as const, icon: Brain, label: t("filterThinking") },
    { key: "showToolUse" as const, icon: Wrench, label: t("filterTools") },
    { key: "showToolResult" as const, icon: ClipboardList, label: t("filterResults") },
  ];

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      {toggles.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange({ ...preferences, [key]: !preferences[key] })}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-colors cursor-pointer",
            preferences[key]
              ? "bg-[var(--primary-muted)] text-[var(--primary)]"
              : "bg-[var(--muted)] text-[var(--muted-foreground)] opacity-50",
          )}
        >
          <Icon size={10} />
          {label}
        </button>
      ))}
    </div>
  );
}
