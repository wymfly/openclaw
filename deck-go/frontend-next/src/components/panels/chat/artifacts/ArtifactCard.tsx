"use client";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ArtifactInfo } from "./detectArtifact";

interface ArtifactCardProps {
  artifact: ArtifactInfo;
  onOpen: (artifact: ArtifactInfo) => void;
}

export function ArtifactCard({ artifact, onOpen }: ArtifactCardProps) {
  const t = useTranslations("chat");
  return (
    <div className="my-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary-muted)] ring-1 ring-[var(--primary)]/20 text-xs">
      <Play size={14} className="text-[var(--primary)] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-[var(--foreground)]">
          {t.has(artifact.title) ? t(artifact.title) : artifact.title}
        </span>
        <span className="ml-2 text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">
          {artifact.language}
        </span>
      </div>
      <Button
        size="xs"
        variant="outline"
        className="shrink-0 cursor-pointer"
        onClick={() => onOpen(artifact)}
      >
        {t("openArtifact")}
      </Button>
    </div>
  );
}
