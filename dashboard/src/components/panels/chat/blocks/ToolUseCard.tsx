"use client";
import { Wrench } from "lucide-react";
import { useTranslations } from "next-intl";

interface ToolUseCardProps {
  name: string;
  input: Record<string, unknown>;
}

export function ToolUseCard({ name, input }: ToolUseCardProps) {
  const t = useTranslations("chat");
  return (
    <details className="my-1.5 text-xs rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      <summary className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
        <Wrench size={12} className="shrink-0" />
        <span className="font-medium">{t("toolCall")}:</span>
        <code className="font-mono text-[var(--accent)]">{name}</code>
      </summary>
      <div className="px-2.5 pb-2.5 border-t border-[var(--border-subtle)]">
        <pre className="mt-1.5 p-2 rounded-lg text-xs overflow-auto bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
          {JSON.stringify(input, null, 2)}
        </pre>
      </div>
    </details>
  );
}
