"use client";

import { useMemo } from "react";
import type { ArtifactInfo } from "../artifacts/detectArtifact";
import { CodeViewer } from "./CodeViewer";
import { JsonTree } from "./JsonTree";
import { MarkdownViewer } from "./MarkdownViewer";
import { buildSrcdoc, usesIframe } from "./srcdoc";
import { TableViewer } from "./TableViewer";

interface SharedRendererProps {
  artifact: ArtifactInfo;
  className?: string;
}

export function SharedRenderer({ artifact, className }: SharedRendererProps) {
  const srcdoc = useMemo(
    () => (usesIframe(artifact.language) ? buildSrcdoc(artifact) : ""),
    [artifact],
  );

  return (
    <div className={className ?? "flex-1 min-h-0 overflow-auto"}>
      {usesIframe(artifact.language) ? (
        <iframe
          srcDoc={srcdoc}
          sandbox="allow-scripts"
          className="w-full h-full border-0"
          title={artifact.title}
        />
      ) : artifact.language === "json" ? (
        <JsonTree content={artifact.content} />
      ) : artifact.language === "csv" ? (
        <TableViewer content={artifact.content} />
      ) : artifact.language === "markdown" ? (
        <MarkdownViewer content={artifact.content} />
      ) : artifact.language === "code" ? (
        <CodeViewer content={artifact.content} language={artifact.codeLang} />
      ) : artifact.language === "image" ? (
        <div className="flex items-center justify-center p-4 h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artifact.content}
            alt={artifact.title}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
