"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { useDocsStore, type DocCategory } from "@/stores/docs";

const CATEGORY_COLORS: Record<DocCategory, string> = {
  summary: "var(--doc-summary)",
  plan: "var(--doc-plan)",
  spec: "var(--doc-spec)",
  manual: "var(--doc-manual)",
  draft: "var(--doc-draft)",
};

export function DocViewer() {
  const t = useTranslations("docs");
  const tc = useTranslations("common");
  const { selectedDoc, deleteDoc, selectDoc } = useDocsStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!selectedDoc) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--muted-foreground)" }}
      >
        <p className="text-sm">{t("noResults")}</p>
      </div>
    );
  }

  const handleDelete = async () => {
    await deleteDoc(selectedDoc.id);
    selectDoc(null);
    setConfirmDelete(false);
  };

  const color = CATEGORY_COLORS[selectedDoc.category];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
          <span className="text-xs font-medium" style={{ color }}>
            {t(`category.${selectedDoc.category}`)}
          </span>
        </div>
        <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
          {selectedDoc.title}
        </h2>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 chat-prose max-w-none text-sm"
        style={{ color: "var(--foreground)" }}
      >
        <Streamdown mode="static">{selectedDoc.content}</Streamdown>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 border-t flex items-center justify-between"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div className="flex flex-col gap-1">
          {/* Keywords */}
          {selectedDoc.keywords.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {selectedDoc.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "var(--background)",
                    color: "var(--muted-foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {selectedDoc.sourceSession && (
              <span>
                {t("source")}: {selectedDoc.sourceSession}
              </span>
            )}
            <span>
              {t("extractedAt")}: {new Date(selectedDoc.extractedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-1 text-xs rounded-md font-medium"
              style={{ backgroundColor: "var(--destructive)", color: "var(--destructive-fg)" }}
              onClick={() => void handleDelete()}
            >
              {t("confirmDelete")}
            </button>
            <button
              type="button"
              className="px-3 py-1 text-xs rounded-md font-medium"
              style={{ color: "var(--muted-foreground)" }}
              onClick={() => setConfirmDelete(false)}
            >
              {tc("cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="px-3 py-1 text-xs rounded-md font-medium"
            style={{ color: "var(--destructive)" }}
            onClick={() => setConfirmDelete(true)}
          >
            {t("delete")}
          </button>
        )}
      </div>
    </div>
  );
}
