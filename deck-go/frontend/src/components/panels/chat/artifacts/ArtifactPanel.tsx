import { useTranslations } from "next-intl";
import { useState } from "react";
import { MarkdownText } from "../MarkdownText";
import type { ArtifactInfo } from "./detectArtifact";

const EXTENSION_MAP: Record<ArtifactInfo["language"], string> = {
  code: "txt",
  csv: "csv",
  html: "html",
  image: "png",
  json: "json",
  markdown: "md",
  mermaid: "mmd",
  svg: "svg",
  text: "txt",
};

const MIME_MAP: Record<ArtifactInfo["language"], string> = {
  code: "text/plain",
  csv: "text/csv",
  html: "text/html",
  image: "image/png",
  json: "application/json",
  markdown: "text/markdown",
  mermaid: "text/plain",
  svg: "image/svg+xml",
  text: "text/plain",
};

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
    await navigator.clipboard.writeText(artifact.content);
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
          className="deck-ui-tool-control"
          type="button"
          onClick={() => setFullscreen((current) => !current)}
          title={t("artifactFullscreen")}
          aria-pressed={fullscreen}
        >
          {t("artifactFullscreen")}
        </button>
        <button
          className="deck-ui-tool-control"
          type="button"
          onClick={onClose}
          aria-label={t("artifactClose")}
        >
          x
        </button>
      </div>
      {usesIframe(artifact.language) ? (
        <iframe srcDoc={buildSrcDoc(artifact)} sandbox="allow-scripts" title={title} />
      ) : artifact.language === "image" ? (
        <img src={artifact.content} alt={title} />
      ) : artifact.language === "json" ? (
        <JsonArtifact content={artifact.content} invalidLabel={t("artifactJsonInvalid")} />
      ) : artifact.language === "csv" ? (
        <CsvTable content={artifact.content} emptyLabel={t("artifactCsvEmpty")} />
      ) : artifact.language === "markdown" ? (
        <MarkdownText text={artifact.content} />
      ) : (
        <pre className="deck-ui-artifact-code">{artifact.content}</pre>
      )}
    </section>
  );
}

function downloadArtifact(artifact: ArtifactInfo) {
  const blob = buildDownloadBlob(artifact);
  if (!blob) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildDownloadFilename(artifact);
  link.click();
  URL.revokeObjectURL(url);
}

function buildDownloadBlob(artifact: ArtifactInfo): Blob | null {
  if (artifact.language === "image") {
    const match = artifact.content.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
      return null;
    }
    try {
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: match[1] });
    } catch {
      return new Blob([artifact.content], { type: "text/plain" });
    }
  }

  return new Blob([artifact.content], { type: MIME_MAP[artifact.language] });
}

function buildDownloadFilename(artifact: ArtifactInfo): string {
  return artifact.source?.fileName ?? `artifact.${EXTENSION_MAP[artifact.language]}`;
}

function usesIframe(language: ArtifactInfo["language"]): boolean {
  return language === "html" || language === "svg" || language === "mermaid" || language === "text";
}

function buildSrcDoc(artifact: ArtifactInfo): string {
  switch (artifact.language) {
    case "html":
      return artifact.content;
    case "svg":
      return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">${artifact.content}</body></html>`;
    case "mermaid":
      return `<!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script></head><body><pre class="mermaid">${escapeHtml(artifact.content)}</pre><script>mermaid.initialize({startOnLoad:true,theme:'default'});</script></body></html>`;
    case "text":
      return `<!DOCTYPE html><html><body><pre style="margin:16px;font-family:monospace;white-space:pre-wrap">${escapeHtml(artifact.content)}</pre></body></html>`;
    default:
      return artifact.content;
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function JsonArtifact({ content, invalidLabel }: { content: string; invalidLabel: string }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return (
      <pre className="deck-ui-artifact-code" data-artifact-view="json-error">
        {invalidLabel}
      </pre>
    );
  }

  return (
    <div className="deck-ui-artifact-json" data-artifact-view="json">
      <JsonValue value={parsed} />
    </div>
  );
}

function JsonValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span>null</span>;
  }
  if (typeof value === "string") {
    return <span>&quot;{value}&quot;</span>;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <details open>
        <summary>[{value.length} items]</summary>
        {value.map((item, index) => (
          <div key={index}>
            <JsonValue value={item} />
          </div>
        ))}
      </details>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <details open>
        <summary>
          {"{"}
          {entries.length} keys{"}"}
        </summary>
        {entries.map(([key, entryValue]) => (
          <div key={key}>
            <span>&quot;{key}&quot;: </span>
            <JsonValue value={entryValue} />
          </div>
        ))}
      </details>
    );
  }

  return <span>{JSON.stringify(value)}</span>;
}

function CsvTable({ content, emptyLabel }: { content: string; emptyLabel: string }) {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) {
    return <p className="deck-ui-artifact-empty">{emptyLabel}</p>;
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);

  return (
    <table className="deck-ui-artifact-table">
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={index}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"' && inQuotes) {
      current += '"';
      index++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
