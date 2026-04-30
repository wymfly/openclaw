import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { ArtifactInfo, ArtifactLanguage } from "../artifacts/detectArtifact";
import { CodeViewer } from "./CodeViewer";
import { JsonTree } from "./JsonTree";
import { MarkdownViewer } from "./MarkdownViewer";
import { buildSrcdoc, usesIframe } from "./srcdoc";
import { TableViewer } from "./TableViewer";

export function SharedRenderer({
  artifact,
  className,
  forceLanguage,
}: {
  artifact: ArtifactInfo;
  className?: string;
  forceLanguage?: ArtifactLanguage;
}) {
  const t = useTranslations("chat");
  const effectiveLanguage: ArtifactLanguage = forceLanguage ?? artifact.language;
  const effectiveArtifact = useMemo<ArtifactInfo>(
    () => (forceLanguage ? { ...artifact, language: forceLanguage } : artifact),
    [artifact, forceLanguage],
  );
  const srcdoc = useMemo(
    () => (usesIframe(effectiveLanguage) ? buildSrcdoc(effectiveArtifact) : ""),
    [effectiveArtifact, effectiveLanguage],
  );
  const fallbackLines = useMemo(
    () => (effectiveLanguage === "text" ? artifact.content.split("\n") : []),
    [artifact.content, effectiveLanguage],
  );

  return (
    <div className={className ?? "ds-shared-renderer"}>
      {usesIframe(effectiveLanguage) ? (
        <div className="ds-artifact-body__html-stub">
          <div className="ds-artifact-body__html-bar">{t("artifactHtmlStubLabel")}</div>
          <iframe
            className="ds-artifact-body__html-canvas"
            srcDoc={srcdoc}
            sandbox="allow-scripts"
            title={artifact.title}
          />
        </div>
      ) : effectiveLanguage === "json" ? (
        <JsonTree content={artifact.content} />
      ) : effectiveLanguage === "csv" ? (
        <TableViewer content={artifact.content} />
      ) : effectiveLanguage === "markdown" ? (
        <MarkdownViewer content={artifact.content} />
      ) : effectiveLanguage === "code" ? (
        <CodeViewer content={artifact.content} language={artifact.codeLang} />
      ) : effectiveLanguage === "image" ? (
        <div className="ds-artifact-body__image">
          <img src={artifact.content} alt={artifact.title} />
        </div>
      ) : (
        <pre className="ds-artifact-body__code">
          {fallbackLines.map((line, index) => (
            <div className="ds-artifact-body__code-line" key={index}>
              <span className="ds-artifact-body__code-ln">{index + 1}</span>
              <code>{line || " "}</code>
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}
