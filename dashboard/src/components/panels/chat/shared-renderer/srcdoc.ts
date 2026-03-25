import type { ArtifactInfo } from "../artifacts/detectArtifact";

/** Build an HTML srcdoc for iframe-rendered artifact types. */
export function buildSrcdoc(artifact: ArtifactInfo): string {
  switch (artifact.language) {
    case "html":
      return artifact.content;
    case "svg":
      return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">${artifact.content}</body></html>`;
    case "mermaid":
      return `<!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script></head><body><pre class="mermaid">${artifact.content.replace(/</g, "&lt;")}</pre><script>mermaid.initialize({startOnLoad:true,theme:'default'});</script></body></html>`;
    default:
      return `<!DOCTYPE html><html><body><pre style="margin:16px;font-family:monospace;white-space:pre-wrap">${artifact.content.replace(/</g, "&lt;")}</pre></body></html>`;
  }
}

/** Whether this artifact type uses an iframe for rendering. */
export function usesIframe(language: ArtifactInfo["language"]): boolean {
  return language === "html" || language === "svg" || language === "mermaid" || language === "text";
}
