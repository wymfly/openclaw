"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useMemoryStore, type MemoryFileNode } from "@/stores/memory";

// ---------------------------------------------------------------------------
// Icons (inline SVG to avoid extra deps — matches lucide-react style)
// ---------------------------------------------------------------------------

function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {open ? (
        // FolderOpen
        <>
          <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v1" />
          <path d="M20.27 13.73A2.5 2.5 0 0 0 17.5 12H9.5a2.5 2.5 0 0 0-2.42 1.87L5 21h14l1.27-7.27Z" />
        </>
      ) : (
        // Folder
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      )}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 13H8" />
      <path d="M16 17H8" />
      <path d="M16 13h-2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// TreeNode component
// ---------------------------------------------------------------------------

function TreeNode({
  node,
  depth,
  onSelect,
}: {
  node: MemoryFileNode;
  depth: number;
  onSelect: (node: MemoryFileNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    if (node.type === "directory") {
      setExpanded(!expanded);
      onSelect(node);
    } else {
      onSelect(node);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded hover:bg-[var(--muted)] cursor-pointer"
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          color: "var(--foreground)",
          fontSize: 13,
        }}
      >
        {node.type === "directory" ? <FolderIcon open={expanded} /> : <FileIcon />}
        <span className="truncate">{node.name}</span>
        {node.size !== undefined && node.type === "file" && (
          <span className="ml-auto text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>
            {formatSize(node.size)}
          </span>
        )}
      </button>
      {expanded &&
        node.children?.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onSelect={onSelect} />
        ))}
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ---------------------------------------------------------------------------
// FileTree
// ---------------------------------------------------------------------------

/**
 * Hierarchical expandable tree: folders expand on click, files show content.
 */
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
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--muted-foreground)" }}
      >
        <p className="text-sm">{t("agent")}</p>
      </div>
    );
  }

  if (loading && files.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--muted-foreground)" }}
      >
        <p className="text-sm">...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* File tree sidebar */}
      <div
        className="w-64 shrink-0 overflow-y-auto border-r py-2"
        style={{ borderColor: "var(--border)" }}
      >
        {files.length === 0 ? (
          <p className="text-xs px-3 py-2" style={{ color: "var(--muted-foreground)" }}>
            {t("noFiles")}
          </p>
        ) : (
          files.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} onSelect={handleSelect} />
          ))
        )}
      </div>

      {/* File content preview */}
      <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: "var(--background)" }}>
        {selectedFilePath && selectedFileContent !== null ? (
          <div>
            <div
              className="text-xs mb-2 pb-2 border-b"
              style={{
                color: "var(--muted-foreground)",
                borderColor: "var(--border)",
              }}
            >
              {selectedFilePath}
            </div>
            <pre
              className="text-xs whitespace-pre-wrap break-words"
              style={{
                color: "var(--foreground)",
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
              }}
            >
              {selectedFileContent}
            </pre>
          </div>
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--muted-foreground)" }}
          >
            <p className="text-sm">{t("content")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
