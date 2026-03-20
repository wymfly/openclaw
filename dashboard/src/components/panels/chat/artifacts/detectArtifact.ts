export interface ArtifactInfo {
  id: string;
  title: string;
  language: "html" | "mermaid" | "svg" | "text";
  content: string;
}

let artifactCounter = 0;

export function detectArtifact(content: string): ArtifactInfo | null {
  if (typeof content !== "string" || content.length < 20) {
    return null;
  }

  // 1. HTML content
  if (/<html|<body|<!doctype/i.test(content)) {
    const titleMatch = /<title>(.*?)<\/title>/i.exec(content);
    return {
      id: `artifact-${++artifactCounter}`,
      title: titleMatch?.[1] ?? "HTML",
      language: "html",
      content,
    };
  }

  // 2. SVG content
  if (content.trimStart().startsWith("<svg")) {
    return { id: `artifact-${++artifactCounter}`, title: "SVG", language: "svg", content };
  }

  // 3. Mermaid diagram
  const mermaidMatch = /```mermaid\n([\s\S]+?)```/.exec(content);
  if (mermaidMatch) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "Diagram",
      language: "mermaid",
      content: mermaidMatch[1],
    };
  }

  return null;
}
