import type { ArtifactInfo } from "../artifacts/detectArtifact";

type ArtifactLanguage = ArtifactInfo["language"];

export const EXTENSION_MAP: Record<ArtifactLanguage, string> = {
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

export const MIME_MAP: Record<ArtifactLanguage, string> = {
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

export function buildDownloadFilename(artifact: ArtifactInfo): string {
  return artifact.source?.fileName ?? `artifact.${EXTENSION_MAP[artifact.language]}`;
}

export function downloadArtifact(artifact: ArtifactInfo): void {
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
  if (artifact.language !== "image") {
    return new Blob([artifact.content], { type: MIME_MAP[artifact.language] });
  }

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
