"use client";

import { Folder, FolderOpen, FileText, Brain } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMemoryStore, type MemoryFileNode } from "@/stores/memory";

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: MemoryFileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: MemoryFileNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (node.type === "directory") {
      setExpanded(!expanded);
    }
    onSelect(node);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "relative flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-[13px] cursor-pointer transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-inset",
          isSelected
            ? "bg-[var(--accent-muted)] text-[var(--accent)]"
            : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isSelected && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]"
            aria-hidden
          />
        )}
        {node.type === "directory" ? (
          expanded ? (
            <FolderOpen size={14} className="shrink-0 text-[var(--accent)]" />
          ) : (
            <Folder size={14} className="shrink-0 text-[var(--text-secondary)]" />
          )
        ) : (
          <FileText size={14} className="shrink-0 text-[var(--text-secondary)]" />
        )}
        <span className="truncate">{node.name}</span>
        {node.size !== undefined && node.type === "file" && (
          <span className="ml-auto text-[10px] font-mono shrink-0 text-[var(--text-secondary)]">
            {formatSize(node.size)}
          </span>
        )}
      </button>
      {expanded &&
        node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

export function FileTree() {
  const t = useTranslations("memory");
  const {
    files,
    selectedAgentId,
    selectedFilePath,
    selectedFileContent,
    loading,
    readFile,
    browseFiles,
  } = useMemoryStore();

  const handleSelect = useCallback(
    (node: MemoryFileNode) => {
      if (!selectedAgentId) {
        return;
      }
      if (node.type === "file") {
        void readFile(selectedAgentId, node.path);
      } else {
        void browseFiles(selectedAgentId, node.path);
      }
    },
    [selectedAgentId, readFile, browseFiles],
  );

  if (!selectedAgentId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--text-secondary)]">
        <Brain size={18} className="text-[var(--accent)]" />
        <p className="text-sm">{t("agent")}</p>
      </div>
    );
  }

  if (loading && files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        <p className="text-sm animate-pulse">...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* File tree sidebar */}
      <ScrollArea className="w-64 shrink-0 border-r border-[var(--border)] py-1">
        {files.length === 0 ? (
          <p className="text-xs px-3 py-2 text-[var(--text-secondary)]">{t("noFiles")}</p>
        ) : (
          files.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedFilePath}
              onSelect={handleSelect}
            />
          ))
        )}
      </ScrollArea>

      {/* File content preview */}
      <ScrollArea className="flex-1 p-4">
        {selectedFilePath && selectedFileContent !== null ? (
          <div>
            <div className="flex items-center gap-2 text-xs mb-3 pb-2 border-b border-[var(--border-subtle)]">
              <FileText size={12} className="text-[var(--text-secondary)]" />
              <span className="font-mono text-[var(--text-secondary)]">{selectedFilePath}</span>
            </div>
            <pre className="text-xs whitespace-pre-wrap break-words text-[var(--text-primary)] font-mono leading-relaxed">
              {selectedFileContent}
            </pre>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            <p className="text-sm">{t("content")}</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
