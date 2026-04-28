import { useTranslations } from "next-intl";
import { useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, MaximizeIcon, XIcon } from "@/deck-ui/icons";
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

  return (
    <section
      className={fullscreen ? "deck-ui-artifact deck-ui-artifact-fullscreen" : "deck-ui-artifact"}
      data-fullscreen={fullscreen ? "true" : "false"}
    >
      <div className="deck-ui-artifact-head">
        <strong>{title}</strong>
        <span className="deck-ui-artifact-language">{artifact.language}</span>
        <button
          className="deck-ui-tool-control"
          type="button"
          onClick={() => downloadArtifact(artifact)}
          aria-label={t("artifactDownload")}
          title={t("artifactDownload")}
        >
          <DownloadIcon />
          <span className="deck-ui-sr-only">{t("artifactDownload")}</span>
        </button>
        <button
          className="deck-ui-tool-control"
          type="button"
          onClick={() => void handleCopy()}
          aria-label={copied ? t("copied") : t("artifactCopy")}
          title={t("artifactCopy")}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="deck-ui-sr-only">{copied ? t("copied") : t("artifactCopy")}</span>
        </button>
        <button
          aria-pressed={fullscreen}
          aria-label={t("artifactFullscreen")}
          className="deck-ui-tool-control"
          title={t("artifactFullscreen")}
          type="button"
          onClick={() => setFullscreen((current) => !current)}
        >
          <MaximizeIcon />
          <span className="deck-ui-sr-only">{t("artifactFullscreen")}</span>
        </button>
        <button
          aria-label={t("artifactClose")}
          className="deck-ui-tool-control"
          type="button"
          onClick={onClose}
        >
          <XIcon />
          <span className="deck-ui-sr-only">{t("artifactClose")}</span>
        </button>
      </div>
      <SharedRenderer artifact={artifact} className="deck-ui-artifact-body" />
    </section>
  );
}
