"use client";

import { FileCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDocsStore, type DocCategory } from "@/stores/docs";

/* Map categories to CSS var–based classes to avoid inline style */
const CATEGORY_DOT: Record<DocCategory, string> = {
  summary: "bg-[var(--chart-1)]",
  plan: "bg-[var(--chart-2)]",
  spec: "bg-[var(--chart-5)]",
  manual: "bg-[var(--chart-4)]",
  draft: "bg-[var(--text-secondary)]",
};

const CATEGORY_TEXT: Record<DocCategory, string> = {
  summary: "text-[var(--chart-1)]",
  plan: "text-[var(--chart-2)]",
  spec: "text-[var(--chart-5)]",
  manual: "text-[var(--chart-4)]",
  draft: "text-[var(--text-secondary)]",
};

export function DocViewer() {
  const t = useTranslations("docs");
  const tc = useTranslations("common");
  const { selectedDoc, deleteDoc, selectDoc } = useDocsStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!selectedDoc) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full text-[var(--text-secondary)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]">
          <FileCode size={20} className="text-[var(--accent)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{t("noResults")}</p>
      </div>
    );
  }

  const handleDelete = async () => {
    await deleteDoc(selectedDoc.id);
    selectDoc(null);
    setConfirmDelete(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn("w-2 h-2 rounded-full inline-block", CATEGORY_DOT[selectedDoc.category])}
          />
          <span className={cn("text-xs font-medium", CATEGORY_TEXT[selectedDoc.category])}>
            {t(`category.${selectedDoc.category}`)}
          </span>
        </div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">{selectedDoc.title}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 prose prose-sm max-w-none dark:prose-invert text-[var(--text-primary)]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedDoc.content}</ReactMarkdown>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)]">
        <div className="flex flex-col gap-1">
          {/* Keywords */}
          {selectedDoc.keywords.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {selectedDoc.keywords.map((kw) => (
                <Badge
                  key={kw}
                  variant="outline"
                  className="text-xs border-[var(--border)] text-[var(--text-secondary)]"
                >
                  {kw}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-3 text-xs text-[var(--text-secondary)]">
            {selectedDoc.sourceSession && (
              <span>
                {t("source")}: <span className="font-mono">{selectedDoc.sourceSession}</span>
              </span>
            )}
            <span>
              {t("extractedAt")}:{" "}
              <span className="font-mono">
                {new Date(selectedDoc.extractedAt).toLocaleString()}
              </span>
            </span>
          </div>
        </div>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="destructive" size="xs" onClick={() => void handleDelete()}>
              {t("confirmDelete")}
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(false)}>
              {tc("cancel")}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            className="text-[var(--danger)] hover:text-[var(--danger)]"
            onClick={() => setConfirmDelete(true)}
          >
            {t("delete")}
          </Button>
        )}
      </div>
    </div>
  );
}
