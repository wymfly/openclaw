"use client";

import { File, FilePlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeckAgentsStore, type AgentFileEntry } from "@/stores/deck-agents";
import { BootstrapFileEditor } from "./BootstrapFileEditor";

interface FilesBrowserProps {
  agentId: string;
}

function formatSize(bytes?: number): string {
  if (bytes == null) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(ms?: number): string {
  if (ms == null) {
    return "—";
  }
  return new Date(ms).toLocaleDateString();
}

export function FilesBrowser({ agentId }: FilesBrowserProps) {
  const t = useTranslations("context");
  const { agentFilesList, filesListLoading, fetchFilesList } = useDeckAgentsStore();

  const [editorVisible, setEditorVisible] = useState(false);

  useEffect(() => {
    void fetchFilesList(agentId);
  }, [agentId, fetchFilesList]);

  const handleFileClick = useCallback((_file: AgentFileEntry) => {
    // Just expand the editor section; BootstrapFileEditor handles its own selection
    setEditorVisible(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditorVisible(true);
  }, []);

  // Single data source: agents.files.list
  const files = agentFilesList;

  // Convert to BootstrapFileEditor format: { name, exists, charCount }
  const editorFiles = files.map((f) => ({
    name: f.name,
    exists: !f.missing,
    charCount: f.size ?? 0,
  }));

  if (filesListLoading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
        <span className="text-xs text-[var(--muted-foreground)]">{t("filesLoading")}</span>
      </div>
    );
  }

  if (files.length === 0) {
    return <p className="text-xs text-[var(--muted-foreground)] py-2">{t("filesEmpty")}</p>;
  }

  return (
    <div className="space-y-2">
      {/* File list */}
      <div className="space-y-0.5">
        {files.map((file) => (
          <div
            key={file.name}
            role="button"
            tabIndex={0}
            onClick={() => handleFileClick(file)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFileClick(file);
            }}
            className="flex items-center gap-3 w-full px-2 py-1.5 rounded text-left transition-colors cursor-pointer hover:bg-[var(--accent)]"
          >
            <File size={14} className="text-[var(--muted-foreground)] shrink-0" />
            <span className="text-xs font-mono text-[var(--foreground)] flex-1 min-w-0 truncate">
              {file.name}
            </span>
            {file.missing ? (
              <div className="flex items-center gap-1.5">
                <Badge className="text-[9px] bg-[var(--destructive-muted)] text-[var(--destructive)] border-0">
                  {t("fileMissing")}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateClick();
                  }}
                >
                  <FilePlus size={10} className="mr-0.5" />
                  {t("fileCreate")}
                </Button>
              </div>
            ) : (
              <>
                <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums shrink-0">
                  {formatSize(file.size)}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
                  {formatDate(file.updatedAtMs)}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Editor area */}
      {editorVisible && editorFiles.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] pt-2">
          <BootstrapFileEditor agentId={agentId} files={editorFiles} />
        </div>
      )}
    </div>
  );
}
