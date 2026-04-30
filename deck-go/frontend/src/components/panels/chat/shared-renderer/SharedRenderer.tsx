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
  const effectiveLanguage: ArtifactLanguage = forceLanguage ?? artifact.language;
  const effectiveArtifact = useMemo<ArtifactInfo>(
    () => (forceLanguage ? { ...artifact, language: forceLanguage } : artifact),
    [artifact, forceLanguage],
  );
  const srcdoc = useMemo(
    () => (usesIframe(effectiveLanguage) ? buildSrcdoc(effectiveArtifact) : ""),
    [effectiveArtifact, effectiveLanguage],
  );

  return (
    <div className={className ?? "ds-shared-renderer"}>
      {usesIframe(effectiveLanguage) ? (
        <iframe srcDoc={srcdoc} sandbox="allow-scripts" title={artifact.title} />
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
        <pre className="ds-artifact-body__code">{artifact.content}</pre>
      )}
    </div>
  );
}
