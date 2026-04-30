import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  MaximizeIcon,
  XIcon,
} from "@/deck-ui/icons";
import { IconButton } from "@/design-system/atoms/IconButton";
import { downloadArtifact } from "../shared-renderer/download";
import { SharedRenderer } from "../shared-renderer/SharedRenderer";
import type { ArtifactInfo, ArtifactLanguage } from "./detectArtifact";

const TABS: ReadonlyArray<{ id: ArtifactLanguage; key: string }> = [
  { id: "code", key: "artifactTabCode" },
  { id: "markdown", key: "artifactTabMarkdown" },
  { id: "json", key: "artifactTabJson" },
  { id: "csv", key: "artifactTabTable" },
  { id: "html", key: "artifactTabHtml" },
];

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
  const [forcedLanguage, setForcedLanguage] = useState<ArtifactLanguage | null>(null);
  const title = t.has(artifact.title) ? t(artifact.title) : artifact.title;
  const effectiveLanguage = forcedLanguage ?? artifact.language;
  const langLabel = (artifact.codeLang ?? effectiveLanguage).toLowerCase();
  const lineCount = artifact.content.split("\n").length;

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sectionClasses = ["ds-artifact-panel", "deck-ui-artifact"];
  if (fullscreen) {
    sectionClasses.push("ds-artifact-panel--fullscreen");
  }

  return (
    <section className={sectionClasses.join(" ")} data-fullscreen={fullscreen ? "true" : "false"}>
      <div className="ds-artifact-panel__head">
        <FileTextIcon className="ds-artifact-panel__head-icon" aria-hidden="true" />
        <div className="ds-artifact-panel__title-stack">
          <span className="ds-artifact-panel__title">{title}</span>
          <span className="ds-artifact-panel__sub">
            {langLabel} · {t("artifactLines", { count: lineCount })}
          </span>
        </div>
        <span className="ds-artifact-panel__head-spacer" />
        <IconButton
          size="sm"
          aria-label={t("artifactDownload")}
          title={t("artifactDownload")}
          onClick={() => downloadArtifact(artifact)}
        >
          <DownloadIcon />
          <span className="ds-sr-only deck-ui-sr-only">{t("artifactDownload")}</span>
        </IconButton>
        <IconButton
          size="sm"
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
          aria-pressed={fullscreen}
          aria-label={t("artifactFullscreen")}
          title={t("artifactFullscreen")}
          onClick={() => setFullscreen((current) => !current)}
        >
          <MaximizeIcon />
          <span className="ds-sr-only deck-ui-sr-only">{t("artifactFullscreen")}</span>
        </IconButton>
        <IconButton size="sm" aria-label={t("artifactClose")} onClick={onClose}>
          <XIcon />
          <span className="ds-sr-only deck-ui-sr-only">{t("artifactClose")}</span>
        </IconButton>
      </div>
      <div className="ds-artifact-panel__tabs" role="tablist">
        {TABS.map((tab) => {
          const active = effectiveLanguage === tab.id;
          const tabClasses = ["ds-artifact-panel__tab"];
          if (active) {
            tabClasses.push("ds-artifact-panel__tab--active");
          }
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={tabClasses.join(" ")}
              onClick={() => setForcedLanguage(tab.id)}
            >
              {t(tab.key)}
            </button>
          );
        })}
      </div>
      <SharedRenderer
        artifact={artifact}
        className="ds-artifact-panel__body"
        forceLanguage={forcedLanguage ?? undefined}
      />
    </section>
  );
}
