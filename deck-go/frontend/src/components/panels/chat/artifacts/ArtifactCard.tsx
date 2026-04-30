import { useTranslations } from "next-intl";
import { PlayIcon } from "@/deck-ui/icons";
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
    <div className="ds-artifact-card">
      <PlayIcon className="ds-artifact-card__icon" aria-hidden="true" />
      <span className="ds-artifact-card__title">{title}</span>
      <span className="ds-artifact-card__language">{artifact.language}</span>
      <button type="button" onClick={() => onOpen(artifact)}>
        {t("openArtifact")}
      </button>
    </div>
  );
}
