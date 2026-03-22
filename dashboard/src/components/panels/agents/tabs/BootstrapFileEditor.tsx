"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDeckAgentsStore } from "@/stores/deck-agents";
import type { BootstrapFileEntry } from "@/stores/deck-agents";

interface BootstrapFileEditorProps {
  agentId: string;
  files: BootstrapFileEntry[];
}

interface FileEditorState {
  // Which file row is open for editing
  activeName: string | null;
  // Draft content being edited
  draftContent: string;
  // Loading state per file
  loadingName: string | null;
  // Feedback per file: "saved" | "failed" | undefined
  feedback: Record<string, "saved" | "failed" | undefined>;
  // Whether the editor textarea is shown (after fetch)
  editorReady: boolean;
}

export function BootstrapFileEditor({ agentId, files }: BootstrapFileEditorProps) {
  const t = useTranslations("context");
  const { fetchBootstrapFile, saveBootstrapFile, fetchSystemPromptPreview } = useDeckAgentsStore();

  const [state, setState] = useState<FileEditorState>({
    activeName: null,
    draftContent: "",
    loadingName: null,
    feedback: {},
    editorReady: false,
  });

  const handleOpenFile = async (name: string, exists: boolean) => {
    // Toggle off if clicking same file
    if (state.activeName === name) {
      setState((s) => ({ ...s, activeName: null, editorReady: false }));
      return;
    }

    setState((s) => ({ ...s, loadingName: name, activeName: name, editorReady: false }));

    if (exists) {
      await fetchBootstrapFile(agentId, name);
      // Read fresh from store after fetch — verify name matches to avoid stale content
      const detail = useDeckAgentsStore.getState().bootstrapFileDetail;
      const content = detail?.name === name ? (detail.content ?? "") : "";
      setState((s) => ({
        ...s,
        loadingName: null,
        draftContent: content,
        editorReady: true,
      }));
    } else {
      // File doesn't exist yet — open editor with empty content for creation
      setState((s) => ({
        ...s,
        loadingName: null,
        draftContent: "",
        editorReady: true,
      }));
    }
  };

  const handleCancel = () => {
    setState((s) => ({ ...s, activeName: null, editorReady: false, draftContent: "" }));
  };

  const handleSave = async (name: string) => {
    setState((s) => ({ ...s, loadingName: name }));
    const ok = await saveBootstrapFile(agentId, name, state.draftContent);
    setState((s) => ({
      ...s,
      loadingName: null,
      feedback: { ...s.feedback, [name]: ok ? "saved" : "failed" },
    }));

    if (ok) {
      // Refresh prompt preview so char counts update
      void fetchSystemPromptPreview(agentId);
      // Close editor after successful save
      setTimeout(() => {
        setState((s) => ({
          ...s,
          activeName: null,
          editorReady: false,
          draftContent: "",
          feedback: { ...s.feedback, [name]: undefined },
        }));
      }, 1200);
    }
  };

  return (
    <div className="space-y-1.5">
      {files.map((file) => {
        const isActive = state.activeName === file.name;
        const isLoading = state.loadingName === file.name;
        const feedback = state.feedback[file.name];

        return (
          <div
            key={file.name}
            className="border border-[var(--border-subtle)] rounded-md overflow-hidden"
          >
            {/* File row header */}
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    file.exists ? "bg-[var(--success)]" : "bg-[var(--text-secondary)] opacity-40",
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-mono truncate",
                    file.exists ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
                  )}
                >
                  {file.name}
                </span>
                {file.exists && (
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono shrink-0">
                    {file.charCount.toLocaleString()} ch
                  </span>
                )}
              </div>

              {/* Action button — click/edit or create */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => void handleOpenFile(file.name, file.exists)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded border shrink-0 cursor-pointer transition-colors",
                  "border-[var(--border)] text-[var(--text-secondary)]",
                  "hover:border-[var(--accent)] hover:text-[var(--accent)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  isActive && "border-[var(--accent)] text-[var(--accent)]",
                )}
              >
                {isLoading ? "..." : isActive ? t("cancel") : file.exists ? t("edit") : t("create")}
              </button>
            </div>

            {/* Inline editor */}
            {isActive && state.editorReady && (
              <div className="border-t border-[var(--border-subtle)] px-3 py-2 space-y-2">
                <textarea
                  value={state.draftContent}
                  onChange={(e) => setState((s) => ({ ...s, draftContent: e.target.value }))}
                  placeholder={t("editorPlaceholder")}
                  rows={8}
                  className={cn(
                    "w-full text-xs font-mono resize-y",
                    "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
                    "border border-[var(--border)] rounded px-2 py-1.5",
                    "focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]",
                    "placeholder:text-[var(--text-secondary)]",
                  )}
                />

                {/* Feedback */}
                {feedback === "saved" && (
                  <p className="text-[10px] text-[var(--success)]">{t("saved")}</p>
                )}
                {feedback === "failed" && (
                  <p className="text-[10px] text-[var(--danger)]">{t("saveFailed")}</p>
                )}

                {/* Save / Cancel */}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className={cn(
                      "text-xs px-3 py-1 rounded border cursor-pointer transition-colors",
                      "border-[var(--border)] text-[var(--text-secondary)]",
                      "hover:text-[var(--text-primary)]",
                    )}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleSave(file.name)}
                    className={cn(
                      "text-xs px-3 py-1 rounded border cursor-pointer transition-colors",
                      "bg-[var(--accent)] border-[var(--accent)] text-white",
                      "hover:opacity-90",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    {isLoading ? "..." : t("save")}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
