"use client";
import { Copy, Check, X, Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CodeViewer } from "../shared-renderer/CodeViewer";
import { JsonTree } from "../shared-renderer/JsonTree";
import { MarkdownViewer } from "../shared-renderer/MarkdownViewer";
import { buildSrcdoc, usesIframe } from "../shared-renderer/srcdoc";
import { TableViewer } from "../shared-renderer/TableViewer";
import type { ArtifactInfo } from "./detectArtifact";

interface ArtifactPanelProps {
  artifact: ArtifactInfo;
  onClose: () => void;
}

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const srcdoc = useMemo(
    () => (usesIframe(artifact.language) ? buildSrcdoc(artifact) : ""),
    [artifact],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-[var(--card)]",
        fullscreen ? "fixed inset-0 z-50 border border-[var(--border)]" : "h-full",
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] shrink-0">
        <span className="flex-1 text-xs font-medium text-[var(--foreground)] truncate">
          {t.has(artifact.title) ? t(artifact.title) : artifact.title}
        </span>
        <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
          {artifact.language}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleCopy}
          title={t("artifactCopy")}
          className="cursor-pointer"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setFullscreen(!fullscreen)}
          title={t("artifactFullscreen")}
          className="cursor-pointer"
        >
          <Maximize2 size={12} />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onClose}
          title={t("artifactClose")}
          className="cursor-pointer"
        >
          <X size={12} />
        </Button>
      </div>

      {/* Content area — route by artifact type */}
      <div className="flex-1 min-h-0 overflow-auto">
        {usesIframe(artifact.language) ? (
          <iframe
            srcDoc={srcdoc}
            sandbox="allow-scripts"
            className="w-full h-full border-0"
            title={artifact.title}
          />
        ) : artifact.language === "json" ? (
          <JsonTree content={artifact.content} />
        ) : artifact.language === "csv" ? (
          <TableViewer content={artifact.content} />
        ) : artifact.language === "markdown" ? (
          <MarkdownViewer content={artifact.content} />
        ) : artifact.language === "code" ? (
          <CodeViewer content={artifact.content} language={artifact.codeLang} />
        ) : null}
      </div>
    </div>
  );
}
