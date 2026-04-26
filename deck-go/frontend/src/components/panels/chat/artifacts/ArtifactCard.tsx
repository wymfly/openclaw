import { useTranslations } from "next-intl";
import type { ArtifactInfo } from "./detectArtifact";

export function ArtifactCard({
  artifact,
  onOpen,
}: {
  artifact: ArtifactInfo;
  onOpen: (artifact: ArtifactInfo) => void;
}) {
  const t = useTranslations("chat");
  const title = t.has(artifact.title) ? t(artifact.title) : artifact.title;

  return (
    <div className="deck-ui-artifact-card">
      <span className="deck-ui-artifact-card-icon" aria-hidden="true">
        art
      </span>
      <span className="deck-ui-artifact-card-title">{title}</span>
      <span className="deck-ui-artifact-card-language">{artifact.language}</span>
      <button className="deck-ui-tool-control" type="button" onClick={() => onOpen(artifact)}>
        {t("openArtifact")}
      </button>
    </div>
  );
}
