"use client";

import { useTranslations } from "next-intl";
import { useMemoryStore } from "@/stores/memory";

/**
 * KnowledgeGraph — simple list-based view showing memory entries with connections.
 * Each node displays the memory file key and linked items.
 *
 * Full d3-based graph visualization is deferred to a future iteration.
 */
export function KnowledgeGraph() {
  const t = useTranslations("memory");
  const { files, selectedAgentId } = useMemoryStore();

  if (!selectedAgentId) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--muted-foreground)" }}
      >
        <p className="text-sm">{t("agent")}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--muted-foreground)" }}
      >
        <p className="text-sm">{t("noFiles")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="grid gap-2">
        {files.map((node) => (
          <div
            key={node.path}
            className="flex items-center gap-3 px-3 py-2 rounded border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            {/* Node dot */}
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor:
                  node.type === "directory" ? "var(--primary)" : "var(--muted-foreground)",
              }}
            />

            {/* Name */}
            <div className="flex-1 min-w-0">
              <span
                className="text-xs font-medium truncate block"
                style={{ color: "var(--foreground)" }}
              >
                {node.name}
              </span>
              <span className="text-xs truncate block" style={{ color: "var(--muted-foreground)" }}>
                {node.path}
              </span>
            </div>

            {/* Type badge */}
            <span
              className="text-xs px-2 py-0.5 rounded shrink-0"
              style={{
                backgroundColor:
                  node.type === "directory" ? "var(--primary-muted)" : "var(--muted)",
                color: node.type === "directory" ? "var(--primary)" : "var(--muted-foreground)",
              }}
            >
              {node.type}
            </span>

            {/* Connections indicator (files in same directory are related) */}
            {node.children && node.children.length > 0 && (
              <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>
                {node.children.length} items
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
