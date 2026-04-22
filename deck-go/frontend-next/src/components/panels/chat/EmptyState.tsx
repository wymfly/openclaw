"use client";

import { MessageSquare, Sparkles, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, key: "suggestCreative" },
  { icon: Zap, key: "suggestAnalyze" },
  { icon: MessageSquare, key: "suggestExplain" },
] as const;

interface EmptyStateProps {
  /** Called when a suggested prompt is clicked — parent fills the input box. */
  onSelectPrompt?: (text: string) => void;
}

/**
 * Empty state shown when no session is active.
 * Displays welcome text, suggested prompts, and a new session action.
 */
export function EmptyState({ onSelectPrompt }: EmptyStateProps) {
  const t = useTranslations("chat");

  const handlePrompt = (key: string) => {
    const prompt = t(key);
    if (prompt) {
      onSelectPrompt?.(prompt);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--primary-muted)" }}
        >
          <MessageSquare size={24} style={{ color: "var(--primary)" }} />
        </div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          {t("emptyTitle")}
        </h2>
        <p className="text-sm max-w-md" style={{ color: "var(--muted-foreground)" }}>
          {t("emptyDescription")}
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-sm">
        {SUGGESTED_PROMPTS.map(({ icon: Icon, key }) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePrompt(key)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm transition-colors"
            style={{
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            <Icon size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <span>{t(key)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
