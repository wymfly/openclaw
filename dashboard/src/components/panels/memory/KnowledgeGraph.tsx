"use client";

import { Folder, FileText, Brain } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMemoryStore } from "@/stores/memory";

export function KnowledgeGraph() {
  const t = useTranslations("memory");
  const { files, selectedAgentId } = useMemoryStore();

  if (!selectedAgentId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--text-secondary)]">
        <Brain size={18} className="text-[var(--accent)]" />
        <p className="text-sm">{t("agent")}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--text-secondary)]">
        <Brain size={18} className="text-[var(--accent)]" />
        <p className="text-sm">{t("noFiles")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="p-4 h-full">
      <div className="grid gap-2">
        {files.map((node) => {
          const isDir = node.type === "directory";
          return (
            <div
              key={node.path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl ring-1 ring-[var(--border)] card-hover cursor-default transition-colors duration-150"
            >
              {/* Node icon */}
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                  isDir ? "bg-[var(--accent-muted)]" : "bg-[var(--bg-tertiary)]",
                )}
              >
                {isDir ? (
                  <Folder size={14} className="text-[var(--accent)]" />
                ) : (
                  <FileText size={14} className="text-[var(--text-secondary)]" />
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block text-[var(--text-primary)]">
                  {node.name}
                </span>
                <span className="text-[10px] font-mono truncate block text-[var(--text-secondary)]">
                  {node.path}
                </span>
              </div>

              {/* Type badge */}
              <Badge
                className={cn(
                  "text-[10px] shrink-0 h-auto py-0.5",
                  isDir
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
                )}
              >
                {node.type}
              </Badge>

              {/* Connections indicator */}
              {node.children && node.children.length > 0 && (
                <span className="text-[10px] font-mono shrink-0 text-[var(--text-secondary)]">
                  {node.children.length} items
                </span>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
