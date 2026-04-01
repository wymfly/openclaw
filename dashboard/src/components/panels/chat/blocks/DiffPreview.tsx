"use client";

import { diffLines } from "diff";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { isBinaryContent } from "@/lib/tool-result-parser";

// ---------------------------------------------------------------------------
// DiffPreview — lightweight unified diff view for file write/edit results.
//
// Supports two modes:
// 1. Unified diff content (lines with `@@`, `---`, `+++` markers) — parsed
//    and rendered as a standard diff view.
// 2. Plain content — treated as an "all added" block (new file / write).
//
// Binary content is detected and shows a placeholder message.
// ---------------------------------------------------------------------------

interface DiffPreviewProps {
  content: string;
}

/** Line classification for diff rendering. */
type DiffLineKind = "added" | "removed" | "context" | "hunk";

interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** Line number in old file (removed/context lines). */
  oldNum?: number;
  /** Line number in new file (added/context lines). */
  newNum?: number;
}

/**
 * Detect whether the content looks like a unified diff.
 * Requires at least one `@@` hunk header and either `---` or `+++` prefix.
 */
function isUnifiedDiff(content: string): boolean {
  return content.includes("\n@@") && (content.includes("\n---") || content.includes("\n+++"));
}

/**
 * Parse unified diff content into renderable lines.
 */
function parseUnifiedDiff(content: string): DiffLine[] {
  const rawLines = content.split("\n");
  const result: DiffLine[] = [];
  let oldNum = 0;
  let newNum = 0;

  for (const raw of rawLines) {
    if (raw.startsWith("@@")) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldNum = Number(match[1]);
        newNum = Number(match[2]);
      }
      result.push({ kind: "hunk", text: raw });
    } else if (raw.startsWith("---") || raw.startsWith("+++")) {
      // File header lines — render as context
      result.push({ kind: "context", text: raw });
    } else if (raw.startsWith("+")) {
      result.push({ kind: "added", text: raw.slice(1), newNum });
      newNum++;
    } else if (raw.startsWith("-")) {
      result.push({ kind: "removed", text: raw.slice(1), oldNum });
      oldNum++;
    } else {
      // Context line (may start with a space)
      const text = raw.startsWith(" ") ? raw.slice(1) : raw;
      result.push({ kind: "context", text, oldNum, newNum });
      oldNum++;
      newNum++;
    }
  }

  return result;
}

/**
 * Treat plain content as "all added" — renders every line in green.
 */
function parseAsAdded(content: string): DiffLine[] {
  return content.split("\n").map((text, i) => ({
    kind: "added" as const,
    text,
    newNum: i + 1,
  }));
}

/**
 * Compute a diff between old and new content using the `diff` package.
 * Exported for use in future two-panel diff views.
 */
export function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const changes = diffLines(oldContent, newContent);
  const result: DiffLine[] = [];
  let oldNum = 1;
  let newNum = 1;

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, "").split("\n");
    for (const text of lines) {
      if (change.added) {
        result.push({ kind: "added", text, newNum });
        newNum++;
      } else if (change.removed) {
        result.push({ kind: "removed", text, oldNum });
        oldNum++;
      } else {
        result.push({ kind: "context", text, oldNum, newNum });
        oldNum++;
        newNum++;
      }
    }
  }

  return result;
}

const LINE_BG: Record<DiffLineKind, string> = {
  added: "bg-[var(--success-muted)]",
  removed: "bg-[var(--destructive-muted)]",
  context: "",
  hunk: "bg-[var(--muted)]",
};

const LINE_TEXT: Record<DiffLineKind, string> = {
  added: "text-[var(--success-muted-text)]",
  removed: "text-[var(--destructive-muted-text)]",
  context: "text-[var(--foreground)]",
  hunk: "text-[var(--muted-foreground)]",
};

const LINE_PREFIX: Record<DiffLineKind, string> = {
  added: "+",
  removed: "-",
  context: " ",
  hunk: "",
};

export function DiffPreview({ content }: DiffPreviewProps) {
  const t = useTranslations("chat");
  const isBinary = isBinaryContent(content);

  // Compute parsed lines unconditionally to satisfy React hook rules.
  // When binary, the result is unused but the memo is cheap (empty-ish input).
  const lines = useMemo(() => {
    if (isBinary) {
      return [];
    }
    if (isUnifiedDiff(content)) {
      return parseUnifiedDiff(content);
    }
    return parseAsAdded(content);
  }, [content, isBinary]);

  // Binary detection — show placeholder
  if (isBinary) {
    return (
      <div className="my-1.5 px-3 py-2 text-xs rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]">
        {t("binaryFile")}
      </div>
    );
  }

  return (
    <div className="my-1.5 rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      <div className="max-h-[400px] overflow-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className={`${LINE_BG[line.kind]} leading-5`}>
                {/* Old line number */}
                <td className="w-10 px-1.5 text-right select-none text-[var(--text-tertiary)] border-r border-[var(--border-subtle)] align-top whitespace-nowrap">
                  {line.kind !== "hunk" ? (line.oldNum ?? "") : ""}
                </td>
                {/* New line number */}
                <td className="w-10 px-1.5 text-right select-none text-[var(--text-tertiary)] border-r border-[var(--border-subtle)] align-top whitespace-nowrap">
                  {line.kind !== "hunk" ? (line.newNum ?? "") : ""}
                </td>
                {/* Prefix indicator */}
                <td
                  className={`w-4 px-0.5 text-center select-none ${LINE_TEXT[line.kind]} align-top`}
                >
                  {LINE_PREFIX[line.kind]}
                </td>
                {/* Content */}
                <td className={`px-2 ${LINE_TEXT[line.kind]} whitespace-pre-wrap break-all`}>
                  {line.kind === "hunk" ? line.text : line.text || "\u00A0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
