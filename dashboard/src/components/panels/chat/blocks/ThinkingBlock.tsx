"use client";
import { Brain } from "lucide-react";
import { useTranslations } from "next-intl";

export function ThinkingBlock({ text }: { text: string }) {
  const t = useTranslations("chat");
  return (
    <details className="my-1.5 text-xs group/thinking">
      <summary className="flex items-center gap-1.5 cursor-pointer select-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        <Brain size={12} />
        <span>{t("thinking")}</span>
      </summary>
      <pre className="mt-1.5 p-2.5 rounded-lg text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
        {text}
      </pre>
    </details>
  );
}
