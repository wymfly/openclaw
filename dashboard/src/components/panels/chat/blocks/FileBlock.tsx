"use client";
import { File as FileIcon, Download } from "lucide-react";
import { useTranslations } from "next-intl";

interface FileBlockProps {
  data: string;
  mimeType: string;
  fileName: string;
  size?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileBlock({ data, mimeType, fileName, size }: FileBlockProps) {
  const t = useTranslations("chat");

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `data:${mimeType};base64,${data}`;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--muted)] ring-1 ring-[var(--border-subtle)] text-xs">
      <FileIcon size={14} className="text-[var(--muted-foreground)] shrink-0" />
      <div className="min-w-0">
        <span className="font-medium text-[var(--foreground)] truncate block">{fileName}</span>
        {size != null && <span className="text-[var(--muted-foreground)]">{formatSize(size)}</span>}
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="shrink-0 text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors cursor-pointer"
        title={t("download")}
      >
        <Download size={14} />
      </button>
    </div>
  );
}
