"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { type AgentDetail } from "@/stores/deck-agents";

interface PromptPreviewProps {
  content: string;
  detail: AgentDetail;
}

/**
 * Preview mode for system prompt: replaces {{variable}} placeholders
 * with actual values from the agent context.
 */
export function PromptPreview({ content, detail }: PromptPreviewProps) {
  const t = useTranslations("agentDetail");

  const rendered = useMemo(() => {
    const vars: Record<string, string> = {
      agentName: detail.name ?? "",
      agentId: detail.id ?? "",
      model: detail.model ?? "",
      timestamp: new Date().toISOString(),
      channelId: "",
    };
    return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return vars[key] ?? match;
    });
  }, [content, detail]);

  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-[var(--muted-foreground)]">{t("preview")}</h4>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {t("charCount", { chars: charCount, words: wordCount })}
        </span>
      </div>
      <div
        className="rounded-lg border px-3 py-2 text-xs font-mono leading-relaxed whitespace-pre-wrap min-h-[120px] max-h-[300px] overflow-y-auto"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--muted)",
          color: "var(--foreground)",
        }}
      >
        {rendered || <span className="text-[var(--muted-foreground)]">{t("emptyPrompt")}</span>}
      </div>
    </div>
  );
}
