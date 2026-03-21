"use client";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext } from "react";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "../artifacts/ArtifactCard";
import { detectArtifact, type ArtifactInfo } from "../artifacts/detectArtifact";
import { ArtifactContext } from "../ChatPanel";

interface ToolResultCardProps {
  content: string;
  isError?: boolean;
  onOpenArtifact?: (artifact: ArtifactInfo) => void;
}

export function ToolResultCard({ content, isError }: ToolResultCardProps) {
  const t = useTranslations("chat");
  const { onOpenArtifact } = useContext(ArtifactContext);

  const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  const artifact = !isError ? detectArtifact(contentStr) : null;

  return (
    <>
      <details
        className={cn(
          "my-1.5 text-xs rounded-lg border overflow-hidden",
          isError ? "border-[var(--danger)]/30" : "border-[var(--border-subtle)]",
        )}
        open={isError}
      >
        <summary
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none",
            isError
              ? "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
          )}
        >
          {isError ? <X size={12} /> : <Check size={12} />}
          <span className="font-medium">{isError ? t("toolError") : t("toolResult")}</span>
        </summary>
        <pre className="px-2.5 py-2 text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-primary)] text-[var(--text-primary)] max-h-[300px]">
          {contentStr}
        </pre>
      </details>
      {artifact && <ArtifactCard artifact={artifact} onOpen={onOpenArtifact} />}
    </>
  );
}
