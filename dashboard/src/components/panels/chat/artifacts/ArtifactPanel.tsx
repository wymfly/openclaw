"use client";
import { Copy, Check, X, Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CodeViewer } from "./CodeViewer";
import type { ArtifactInfo } from "./detectArtifact";
import { JsonTree } from "./JsonTree";
import { MarkdownViewer } from "./MarkdownViewer";
import { TableViewer } from "./TableViewer";

interface ArtifactPanelProps {
  artifact: ArtifactInfo;
  onClose: () => void;
}

/** Build an HTML srcdoc for iframe-rendered artifact types. */
function buildSrcdoc(artifact: ArtifactInfo): string {
  switch (artifact.language) {
    case "html":
      return artifact.content;
    case "svg":
      return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">${artifact.content}</body></html>`;
    case "mermaid":
      return `<!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script></head><body><pre class="mermaid">${artifact.content.replace(/</g, "&lt;")}</pre><script>mermaid.initialize({startOnLoad:true,theme:'default'});</script></body></html>`;
    default:
      return `<!DOCTYPE html><html><body><pre style="margin:16px;font-family:monospace;white-space:pre-wrap">${artifact.content.replace(/</g, "&lt;")}</pre></body></html>`;
  }
}

/** Whether this artifact type uses an iframe for rendering. */
function usesIframe(language: ArtifactInfo["language"]): boolean {
  return language === "html" || language === "svg" || language === "mermaid" || language === "text";
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
        "flex flex-col border-l border-[var(--border)] bg-[var(--bg-secondary)]",
        fullscreen ? "fixed inset-0 z-50" : "w-1/2",
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] shrink-0">
        <span className="flex-1 text-xs font-medium text-[var(--text-primary)] truncate">
          {t.has(artifact.title) ? t(artifact.title) : artifact.title}
        </span>
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
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
      {usesIframe(artifact.language) ? (
        <iframe
          srcDoc={srcdoc}
          sandbox="allow-scripts"
          className="flex-1 w-full border-0"
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
  );
}
