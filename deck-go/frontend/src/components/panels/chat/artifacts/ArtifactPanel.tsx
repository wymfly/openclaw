import { useTranslations } from "next-intl";
import { useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, MaximizeIcon, XIcon } from "@/deck-ui/icons";
import { IconButton } from "@/design-system/atoms/IconButton";
import { downloadArtifact } from "../shared-renderer/download";
import { SharedRenderer } from "../shared-renderer/SharedRenderer";
import type { ArtifactInfo } from "./detectArtifact";

export function ArtifactPanel({
  artifact,
  onClose,
}: {
  artifact: ArtifactInfo;
  onClose: () => void;
}) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const title = t.has(artifact.title) ? t(artifact.title) : artifact.title;

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sectionClasses = ["ds-artifact-panel", "deck-ui-artifact"];
  if (fullscreen) {
    sectionClasses.push("ds-artifact-panel--fullscreen", "deck-ui-artifact-fullscreen");
  }

  return (
    <section className={sectionClasses.join(" ")} data-fullscreen={fullscreen ? "true" : "false"}>
      <div className="ds-artifact-panel__head deck-ui-artifact-head">
        <strong>{title}</strong>
        <span className="ds-artifact-panel__language deck-ui-artifact-language">
          {artifact.language}
        </span>
        <IconButton
          size="sm"
          className="deck-ui-tool-control"
          aria-label={t("artifactDownload")}
          title={t("artifactDownload")}
          onClick={() => downloadArtifact(artifact)}
        >
          <DownloadIcon />
          <span className="ds-sr-only deck-ui-sr-only">{t("artifactDownload")}</span>
        </IconButton>
        <IconButton
          size="sm"
          className="deck-ui-tool-control"
          aria-label={copied ? t("copied") : t("artifactCopy")}
          title={t("artifactCopy")}
          onClick={() => void handleCopy()}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="ds-sr-only deck-ui-sr-only">
            {copied ? t("copied") : t("artifactCopy")}
          </span>
        </IconButton>
        <IconButton
          size="sm"
          className="deck-ui-tool-control"
          aria-pressed={fullscreen}
          aria-label={t("artifactFullscreen")}
          title={t("artifactFullscreen")}
          onClick={() => setFullscreen((current) => !current)}
        >
          <MaximizeIcon />
          <span className="ds-sr-only deck-ui-sr-only">{t("artifactFullscreen")}</span>
        </IconButton>
        <IconButton
          size="sm"
          className="deck-ui-tool-control"
          aria-label={t("artifactClose")}
          onClick={onClose}
        >
          <XIcon />
          <span className="ds-sr-only deck-ui-sr-only">{t("artifactClose")}</span>
        </IconButton>
      </div>
      <SharedRenderer
        artifact={artifact}
        className="ds-artifact-panel__body deck-ui-artifact-body"
      />
    </section>
  );
}
