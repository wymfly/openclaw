"use client";

import { Download, FileJson, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
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

export function SessionExport({ session, messages }: SessionExportProps) {
  const t = useTranslations("sessions");
  const disabled = messages.length === 0;
  const keySlug = session.key.replace(/[^a-zA-Z0-9\-_]/g, "-").slice(0, 40);
  const date = formatDate();

  const handleJson = () => {
    const content = exportAsJson(session, messages);
    downloadBlob(content, `session-${keySlug}-${date}.json`, "application/json");
  };

  const handleMarkdown = () => {
    const content = exportAsMarkdown(session, messages);
    downloadBlob(content, `session-${keySlug}-${date}.md`, "text/markdown");
  };

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] opacity-50 cursor-not-allowed">
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
      <DropdownMenuTrigger className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] cursor-pointer">
        <Download size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleJson}>
          <FileJson size={14} />
          {t("exportJson")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleMarkdown}>
          <FileText size={14} />
          {t("exportMarkdown")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
