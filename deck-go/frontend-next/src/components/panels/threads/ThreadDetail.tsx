"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { navigateToAgent, navigateToSession } from "@/lib/panel-navigation";
import type { ThreadEntry } from "@/stores/deck-threads";
import { ThreadRelationView } from "./ThreadRelationView";

export function ThreadDetail({ thread }: { thread: ThreadEntry | null }) {
  const t = useTranslations("threads");

  if (!thread) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <h3 className="text-sm font-medium text-[var(--foreground)]">{t("selectThreadTitle")}</h3>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            {t("selectThreadDescription")}
          </p>
        </div>
      </div>
    );
  }

  const copySessionKey = async () => {
    await navigator.clipboard.writeText(thread.targetSessionKey);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {thread.label || thread.threadId}
        </h2>
        <p className="mt-1 text-[10px] font-mono text-[var(--muted-foreground)]">
          {thread.threadId}
        </p>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-2">
          <DetailCard label={t("channel")} value={thread.channelId} />
          <DetailCard label={t("account")} value={thread.accountId} />
          <DetailCard label={t("targetKind")} value={thread.targetKind} />
          <DetailCard label={t("boundBy")} value={thread.boundBy} />
          <DetailCard label={t("boundAt")} value={new Date(thread.boundAt).toLocaleString()} />
          <DetailCard
            label={t("lastActivity")}
            value={new Date(thread.lastActivityAt).toLocaleString()}
          />
        </div>

        <div
          className="rounded-lg border p-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("targetSession")}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--foreground)] break-all">
            {thread.targetSessionKey}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copySessionKey()}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-[var(--foreground)]"
              style={{ borderColor: "var(--border)" }}
            >
              <Copy size={12} />
              {t("copySessionKey")}
            </button>
            <button
              type="button"
              onClick={() => navigateToSession(thread.targetSessionKey)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-[var(--foreground)]"
              style={{ borderColor: "var(--border)" }}
            >
              <ExternalLink size={12} />
              {t("openSession")}
            </button>
          </div>
        </div>

        <div
          className="rounded-lg border p-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("targetAgent")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <AgentBadge agentId={thread.agentId} />
            <button
              type="button"
              onClick={() => navigateToAgent(thread.agentId)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-[var(--foreground)]"
              style={{ borderColor: "var(--border)" }}
            >
              <ExternalLink size={12} />
              {t("openAgent")}
            </button>
          </div>
        </div>

        <ThreadRelationView thread={thread} />
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--foreground)] break-all">{value}</p>
    </div>
  );
}
