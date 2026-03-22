"use client";

import { FileText, FilePlus, FileEdit } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { RunEventRow } from "@/stores/monitor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FileOpKind = "read" | "write" | "modify";

interface FileGroup {
  kind: FileOpKind;
  files: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyFileOp(toolName: string): FileOpKind {
  const lower = toolName.toLowerCase();
  if (lower.includes("write") || lower.includes("create")) {
    return "write";
  }
  if (lower.includes("edit") || lower.includes("modify") || lower.includes("patch")) {
    return "modify";
  }
  return "read";
}

const OP_ICONS: Record<FileOpKind, typeof FileText> = {
  read: FileText,
  write: FilePlus,
  modify: FileEdit,
};

const OP_COLORS: Record<FileOpKind, string> = {
  read: "var(--accent)",
  write: "var(--success)",
  modify: "var(--warning)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FileChangeSummaryProps {
  events: RunEventRow[];
}

export function FileChangeSummary({ events }: FileChangeSummaryProps) {
  const t = useTranslations("monitor");

  const groups = useMemo(() => {
    const fileEvents = events.filter((e) => e.kind === "file_op" || e.kind === "file");
    if (fileEvents.length === 0) {
      return [];
    }

    const groupMap = new Map<FileOpKind, Set<string>>();

    for (const row of fileEvents) {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        // skip
      }

      const toolName =
        (payload.toolName as string | undefined) ?? (payload.name as string | undefined) ?? "";
      const filePath =
        (payload.filePath as string | undefined) ??
        (payload.path as string | undefined) ??
        (payload.file as string | undefined) ??
        toolName;

      const kind = classifyFileOp(toolName);
      const set = groupMap.get(kind) ?? new Set<string>();
      set.add(filePath);
      groupMap.set(kind, set);
    }

    const result: FileGroup[] = [];
    for (const kind of ["write", "modify", "read"] as FileOpKind[]) {
      const files = groupMap.get(kind);
      if (files && files.size > 0) {
        result.push({ kind, files: [...files] });
      }
    }
    return result;
  }, [events]);

  if (groups.length === 0) {
    return (
      <p className="text-xs text-[var(--text-secondary)] italic py-2">
        {t("timeline.noFileChanges")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const Icon = OP_ICONS[group.kind];
        const color = OP_COLORS[group.kind];

        return (
          <div key={group.kind}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={12} style={{ color }} />
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {t(`timeline.fileOp_${group.kind}`)}
              </span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                  color,
                }}
              >
                {group.files.length}
              </span>
            </div>
            <ul className="ml-5 space-y-0.5">
              {group.files.map((file) => (
                <li
                  key={file}
                  className="text-[11px] text-[var(--text-secondary)] font-mono truncate"
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
