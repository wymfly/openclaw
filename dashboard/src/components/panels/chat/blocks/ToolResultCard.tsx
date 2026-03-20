"use client";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext, useState } from "react";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "../artifacts/ArtifactCard";
import { detectArtifact, type ArtifactInfo } from "../artifacts/detectArtifact";
import { ArtifactContext } from "../ChatPanel";

interface ToolResultCardProps {
  content: string;
  isError?: boolean;
  onOpenArtifact?: (artifact: ArtifactInfo) => void;
}

const MAX_PREVIEW_LINES = 8;

export function ToolResultCard({ content, isError }: ToolResultCardProps) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);
  const { onOpenArtifact } = useContext(ArtifactContext);

  const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const lines = contentStr.split("\n");
  const needsFold = lines.length > MAX_PREVIEW_LINES;
  const displayContent =
    needsFold && !expanded ? lines.slice(0, MAX_PREVIEW_LINES).join("\n") + "\n..." : contentStr;

  const artifact = !isError ? detectArtifact(contentStr) : null;

  return (
    <>
      <div
        className={cn(
          "my-1.5 text-xs rounded-lg border overflow-hidden",
          isError ? "border-[var(--danger)]/30" : "border-[var(--border-subtle)]",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5",
            isError
              ? "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
          )}
        >
          {isError ? <X size={12} /> : <Check size={12} />}
          <span className="font-medium">{isError ? t("toolError") : t("toolResult")}</span>
        </div>
        <pre className="px-2.5 py-2 text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-primary)] text-[var(--text-primary)] max-h-[300px]">
          {displayContent}
        </pre>
        {needsFold && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full px-2.5 py-1 text-xs text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer border-t border-[var(--border-subtle)]"
          >
            {expanded ? t("showLess") : t("showMore")}
          </button>
        )}
      </div>
      {artifact && <ArtifactCard artifact={artifact} onOpen={onOpenArtifact} />}
    </>
  );
}
