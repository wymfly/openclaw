"use client";

import { Download, FileJson, FileText, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadBlob, exportAsJson, exportAsMarkdown } from "@/lib/session-export";
import type { HistoryMessage, SessionEntry } from "@/stores/sessions";

interface SessionExportProps {
  session: SessionEntry;
  messages: HistoryMessage[];
}

function formatDate(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Fetch full paginated session history from the sessions-history-http API.
 * Falls back to the provided in-memory messages if the API is unavailable.
 */
async function fetchFullHistory(
  sessionKey: string,
  fallback: HistoryMessage[],
): Promise<HistoryMessage[]> {
  const allMessages: HistoryMessage[] = [];
  let cursor: string | undefined;
  const limit = 100;

  try {
    for (let page = 0; page < 50; page++) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) {
        params.set("cursor", cursor);
      }
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(sessionKey)}/history?${params.toString()}`,
      );
      if (!res.ok) {
        // API not available — fall back to in-memory messages
        return fallback;
      }
      const data = (await res.json()) as {
        messages?: Record<string, unknown>[];
        nextCursor?: string;
      };
      const rawMsgs = data.messages ?? [];
      for (const m of rawMsgs) {
        allMessages.push({
          role: (m.role as HistoryMessage["role"]) ?? "user",
          content: typeof m.content === "string" ? m.content : "",
          timestamp: typeof m.timestamp === "number" ? m.timestamp : undefined,
        });
      }
      if (!data.nextCursor || rawMsgs.length < limit) {
        break;
      }
      cursor = data.nextCursor;
    }
    return allMessages.length > 0 ? allMessages : fallback;
  } catch {
    return fallback;
  }
}

export function SessionExport({ session, messages }: SessionExportProps) {
  const t = useTranslations("sessions");
  const [exporting, setExporting] = useState(false);
  const disabled = messages.length === 0;
  const keySlug = session.key.replace(/[^a-zA-Z0-9\-_]/g, "-").slice(0, 40);
  const date = formatDate();

  const handleJson = async () => {
    setExporting(true);
    try {
      const fullMessages = await fetchFullHistory(session.key, messages);
      const content = exportAsJson(session, fullMessages);
      downloadBlob(content, `session-${keySlug}-${date}.json`, "application/json");
    } finally {
      setExporting(false);
    }
  };

  const handleMarkdown = async () => {
    setExporting(true);
    try {
      const fullMessages = await fetchFullHistory(session.key, messages);
      const content = exportAsMarkdown(session, fullMessages);
      downloadBlob(content, `session-${keySlug}-${date}.md`, "text/markdown");
    } finally {
      setExporting(false);
    }
  };

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--muted-foreground)] opacity-50 cursor-not-allowed">
            <Download size={15} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t("exportEmpty")}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer">
        {exporting ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Download size={15} />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleJson} disabled={exporting}>
          <FileJson size={14} />
          {t("exportJson")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleMarkdown} disabled={exporting}>
          <FileText size={14} />
          {t("exportMarkdown")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
