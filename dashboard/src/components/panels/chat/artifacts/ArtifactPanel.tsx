"use client";
import { Copy, Check, Download, X, Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SharedRenderer } from "../shared-renderer/SharedRenderer";
import { downloadArtifact } from "../shared-renderer/download";
import type { ArtifactInfo } from "./detectArtifact";

interface ArtifactPanelProps {
  artifact: ArtifactInfo;
  onClose: () => void;
}

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

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
          onClick={() => downloadArtifact(artifact)}
          title={t("artifactDownload")}
          className="cursor-pointer"
        >
          <Download size={12} />
        </Button>
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

      {/* Content — delegated to SharedRenderer */}
      <SharedRenderer artifact={artifact} />
    </div>
  );
}
