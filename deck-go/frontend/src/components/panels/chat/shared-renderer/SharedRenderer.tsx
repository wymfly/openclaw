import { useMemo } from "react";
import type { ArtifactInfo } from "../artifacts/detectArtifact";
import { CodeViewer } from "./CodeViewer";
import { JsonTree } from "./JsonTree";
import { MarkdownViewer } from "./MarkdownViewer";
import { buildSrcdoc, usesIframe } from "./srcdoc";
import { TableViewer } from "./TableViewer";

export function SharedRenderer({
  artifact,
  className,
}: {
  artifact: ArtifactInfo;
  className?: string;
}) {
  const srcdoc = useMemo(
    () => (usesIframe(artifact.language) ? buildSrcdoc(artifact) : ""),
    [artifact],
  );

  return (
    <div className={className ?? "deck-ui-shared-renderer"}>
      {usesIframe(artifact.language) ? (
        <iframe srcDoc={srcdoc} sandbox="allow-scripts" title={artifact.title} />
      ) : artifact.language === "json" ? (
        <JsonTree content={artifact.content} />
      ) : artifact.language === "csv" ? (
        <TableViewer content={artifact.content} />
      ) : artifact.language === "markdown" ? (
        <MarkdownViewer content={artifact.content} />
      ) : artifact.language === "code" ? (
        <CodeViewer content={artifact.content} language={artifact.codeLang} />
      ) : artifact.language === "image" ? (
        <div className="deck-ui-artifact-image">
          <img src={artifact.content} alt={artifact.title} />
        </div>
      ) : (
        <pre className="deck-ui-artifact-code">{artifact.content}</pre>
      )}
    </div>
  );
}
