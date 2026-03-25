import type { ArtifactInfo } from "../artifacts/detectArtifact";

type Lang = ArtifactInfo["language"];

export const EXTENSION_MAP: Record<Lang, string> = {
  html: "html",
  svg: "svg",
  mermaid: "mmd",
  json: "json",
  csv: "csv",
  markdown: "md",
  code: "txt",
  text: "txt",
  image: "png",
};

export const MIME_MAP: Record<Lang, string> = {
  html: "text/html",
  svg: "image/svg+xml",
  mermaid: "text/plain",
  json: "application/json",
  csv: "text/csv",
  markdown: "text/markdown",
  code: "text/plain",
  text: "text/plain",
  image: "image/png",
};

export function buildDownloadFilename(artifact: ArtifactInfo): string {
  return (
    artifact.source?.fileName ||
    artifact.title ||
    `artifact.${EXTENSION_MAP[artifact.language]}`
  );
}

export function downloadArtifact(artifact: ArtifactInfo): void {
  const filename = buildDownloadFilename(artifact);

  if (artifact.language === "image") {
    const match = artifact.content.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) return;
    const mime = match[1];
    const base64 = match[2];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    triggerDownload(new Blob([bytes], { type: mime }), filename);
  } else {
    triggerDownload(
      new Blob([artifact.content], { type: MIME_MAP[artifact.language] }),
      filename,
    );
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
