"use client";

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
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">{t("agent")}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">{t("noFiles")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="p-4 h-full">
      <div className="grid gap-2">
        {files.map((node) => (
          <div
            key={node.path}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card"
          >
            {/* Node dot */}
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full shrink-0",
                node.type === "directory" ? "bg-primary" : "bg-muted-foreground",
              )}
            />

            {/* Name */}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium truncate block text-foreground">
                {node.name}
              </span>
              <span className="text-xs truncate block text-muted-foreground">{node.path}</span>
            </div>

            {/* Type badge */}
            <Badge
              variant={node.type === "directory" ? "default" : "secondary"}
              className="text-xs shrink-0"
            >
              {node.type}
            </Badge>

            {/* Connections indicator */}
            {node.children && node.children.length > 0 && (
              <span className="text-xs shrink-0 text-muted-foreground">
                {node.children.length} items
              </span>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
