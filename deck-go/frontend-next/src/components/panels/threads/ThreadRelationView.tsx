"use client";

import { useTranslations } from "next-intl";
import type { ThreadEntry } from "@/stores/deck-threads";

export function ThreadRelationView({ thread }: { thread: ThreadEntry }) {
  const t = useTranslations("threads");

  return (
    <div
      className="rounded-lg border p-3 space-y-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div>
        <h3 className="text-sm font-medium text-[var(--foreground)]">{t("relationTitle")}</h3>
        <p className="text-xs text-[var(--muted-foreground)]">{t("relationDescription")}</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <RelationCard
          label={t("thread")}
          primary={thread.label || thread.threadId}
          secondary={`${t("channel")}: ${thread.channelId}`}
        />
        <RelationCard
          label={t("targetSession")}
          primary={thread.targetSessionKey}
          secondary={`${t("targetKind")}: ${thread.targetKind}`}
        />
        <RelationCard
          label={t("targetAgent")}
          primary={thread.agentId}
          secondary={`${t("account")}: ${thread.accountId}`}
        />
      </div>

      <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        {t("bindingExplanation", {
          boundBy: thread.boundBy,
          kind: thread.targetKind,
        })}
      </div>
    </div>
  );
}

function RelationCard({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-xs font-medium text-[var(--foreground)] break-all">{primary}</p>
      <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{secondary}</p>
    </div>
  );
}
