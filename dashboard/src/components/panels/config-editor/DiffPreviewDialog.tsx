"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DiffEntry } from "@/lib/config-diff";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffPreviewDialogProps {
  entries: DiffEntry[];
  onConfirm: () => void;
  onCancel: () => void;
  onDontShowAgain: () => void;
}

// ---------------------------------------------------------------------------
// Value formatting helper
// ---------------------------------------------------------------------------

function formatValue(val: unknown): string {
  if (val === undefined) {
    return "—";
  }
  if (val === null) {
    return "null";
  }
  if (typeof val === "string") {
    const truncated = val.length > 30 ? `${val.slice(0, 30)}…` : val;
    return `"${truncated}"`;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (Array.isArray(val)) {
    return `[${val.length} items]`;
  }
  if (typeof val === "object") {
    return "{...}";
  }
  // bigint, symbol, or other primitives — safe to JSON.stringify
  return JSON.stringify(val) ?? "?";
}

// ---------------------------------------------------------------------------
// Group entries by top-level section (first segment of path)
// ---------------------------------------------------------------------------

interface SectionGroup {
  section: string;
  entries: DiffEntry[];
}

function groupBySection(entries: DiffEntry[]): SectionGroup[] {
  const map = new Map<string, DiffEntry[]>();
  for (const entry of entries) {
    const section = entry.path.split(".")[0] ?? entry.path;
    if (!map.has(section)) {
      map.set(section, []);
    }
    map.get(section)!.push(entry);
  }
  return Array.from(map.entries()).map(([section, sectionEntries]) => ({
    section,
    entries: sectionEntries,
  }));
}

// ---------------------------------------------------------------------------
// Badge style per diff type
// ---------------------------------------------------------------------------

function DiffTypeBadge({ type, label }: { type: DiffEntry["type"]; label: string }) {
  const classMap: Record<DiffEntry["type"], string> = {
    add: "bg-[var(--success-muted)] text-[var(--success)] border-transparent",
    remove: "bg-[var(--danger-muted)] text-[var(--danger)] border-transparent",
    change: "bg-[var(--warning-muted)] text-[var(--warning-muted-text)] border-transparent",
  };
  return <Badge className={`text-[10px] px-1.5 py-0 ${classMap[type]}`}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// DiffPreviewDialog
// ---------------------------------------------------------------------------

export function DiffPreviewDialog({
  entries,
  onConfirm,
  onCancel,
  onDontShowAgain,
}: DiffPreviewDialogProps) {
  const t = useTranslations("config");
  const [dontShow, setDontShow] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const groups = groupBySection(entries);

  function toggleSection(section: string) {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function isSectionOpen(section: string): boolean {
    // Default open for first section
    if (!(section in openSections)) {
      return groups[0]?.section === section;
    }
    return !!openSections[section];
  }

  function handleConfirm() {
    if (dontShow) {
      onDontShowAgain();
    }
    onConfirm();
  }

  // Label map per diff type
  const typeLabel: Record<DiffEntry["type"], string> = {
    add: t("diffAdded"),
    remove: t("diffRemoved"),
    change: t("diffChanged"),
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("diffPreview")}</DialogTitle>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{t("diffNoChanges")}</p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-1">
            <div className="flex flex-col gap-2">
              {groups.map(({ section, entries: sectionEntries }) => (
                <Collapsible
                  key={section}
                  open={isSectionOpen(section)}
                  onOpenChange={() => toggleSection(section)}
                >
                  {/* Section header */}
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                    {isSectionOpen(section) ? (
                      <ChevronDown size={14} className="shrink-0 text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronRight size={14} className="shrink-0 text-[var(--text-secondary)]" />
                    )}
                    <span className="capitalize">{section}</span>
                    <Badge className="ml-auto bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-transparent text-[10px] px-1.5 py-0">
                      {sectionEntries.length}
                    </Badge>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="flex flex-col gap-1 pl-6 pr-1 pb-1">
                      {sectionEntries.map((entry) => (
                        <div
                          key={entry.path}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs"
                        >
                          {/* Path + type badge */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <DiffTypeBadge type={entry.type} label={typeLabel[entry.type]} />
                            <span className="font-mono text-[var(--text-primary)] break-all">
                              {entry.path}
                            </span>
                          </div>

                          {/* Value display */}
                          {entry.type === "change" && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono line-through text-[var(--danger)]">
                                {formatValue(entry.oldValue)}
                              </span>
                              <span className="text-[var(--text-secondary)]">→</span>
                              <span className="font-mono text-[var(--success)]">
                                {formatValue(entry.newValue)}
                              </span>
                            </div>
                          )}
                          {entry.type === "add" && (
                            <div className="font-mono text-[var(--success)]">
                              {formatValue(entry.newValue)}
                            </div>
                          )}
                          {entry.type === "remove" && (
                            <div className="font-mono line-through text-[var(--danger)]">
                              {formatValue(entry.oldValue)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Don't show again checkbox */}
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-[var(--accent)]"
          />
          {t("diffDontShowAgain")}
        </label>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t("diffCancel")}
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            {t("diffConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
