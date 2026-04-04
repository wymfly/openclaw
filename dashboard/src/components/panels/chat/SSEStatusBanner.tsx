"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSSEStatus } from "@/stores/chat-hooks";

export function SSEStatusBanner() {
  const t = useTranslations("chat");
  const status = useSSEStatus();

  if (status === "connected") {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium"
      style={{
        backgroundColor: "var(--warning-muted)",
        color: "var(--warning-muted-text)",
      }}
    >
      <WifiOff size={12} />
      <span>{status === "reconnecting" ? t("sseReconnecting") : t("sseDisconnected")}</span>
      {status === "reconnecting" && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
      )}
    </div>
  );
}
