"use client";

import { Brain, Cpu, Terminal, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";

export function SessionConfigBar() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const meta = useChatStore((s) => s.sessionMetas.find((m) => m.key === activeSessionKey));

  if (!activeSessionKey || !meta) {
    return null;
  }

  const model = meta.model ?? t("configModelDefault");
  const items: Array<{ icon: React.ReactNode; label: string; value: string }> = [];

  items.push({
    icon: <Cpu size={10} className="text-[var(--muted-foreground)]" />,
    label: t("configModel"),
    value: model,
  });

  if (meta.thinkingLevel) {
    items.push({
      icon: <Brain size={10} className="text-[var(--muted-foreground)]" />,
      label: t("configThinking"),
      value: meta.thinkingLevel,
    });
  }

  if (meta.fastMode !== undefined) {
    items.push({
      icon: <Zap size={10} className="text-[var(--muted-foreground)]" />,
      label: t("configFast"),
      value: meta.fastMode ? t("configOn") : t("configOff"),
    });
  }

  if (meta.verboseLevel) {
    items.push({
      icon: <Terminal size={10} className="text-[var(--muted-foreground)]" />,
      label: t("configVerbose"),
      value: meta.verboseLevel,
    });
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1 text-[10px] font-mono text-[var(--muted-foreground)] border-t border-[var(--border-subtle)]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {item.icon}
          <span>{item.label}</span>
          <span className="text-[var(--primary)]">{item.value}</span>
        </span>
      ))}
    </div>
  );
}
