import { useTranslations } from "next-intl";
import { useState } from "react";
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
          title={t("artifactDownload")}
        >
          {t("artifactDownload")}
        </button>
        <button
          className="deck-ui-tool-control"
          type="button"
          onClick={() => void handleCopy()}
          title={t("artifactCopy")}
        >
          {copied ? t("copied") : t("artifactCopy")}
        </button>
        <button
          aria-pressed={fullscreen}
          className="deck-ui-tool-control"
          title={t("artifactFullscreen")}
          type="button"
          onClick={() => setFullscreen((current) => !current)}
        >
          {t("artifactFullscreen")}
        </button>
        <button
          aria-label={t("artifactClose")}
          className="deck-ui-tool-control"
          type="button"
          onClick={onClose}
        >
          x
        </button>
      </div>
      <SharedRenderer artifact={artifact} className="deck-ui-artifact-body" />
    </section>
  );
}
