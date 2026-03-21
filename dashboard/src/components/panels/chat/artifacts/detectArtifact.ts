export interface ArtifactInfo {
  id: string;
  title: string;
  language: "html" | "mermaid" | "svg" | "json" | "markdown" | "csv" | "code" | "text";
  content: string;
  /** Language hint for code artifacts (file extension). */
  codeLang?: string;
  /** Source context for code artifacts. */
  source?: { toolName?: string; fileName?: string };
}

let artifactCounter = 0;

export function detectArtifact(
  content: string,
  toolContext?: { toolName?: string; filePath?: string },
): ArtifactInfo | null {
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

  // 4. JSON (must be > 40 chars to avoid trivial objects)
  if (content.length > 40) {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === "object" && parsed !== null) {
        return {
          id: `artifact-${++artifactCounter}`,
          title: "artifactJson",
          language: "json",
          content,
        };
      }
    } catch {
      /* not JSON */
    }
  }

  // 5. Markdown (headings, bold, links, checklists) — checked before CSV to avoid
  // misclassifying comma-heavy prose as table data
  if (isLikelyMarkdown(content)) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "artifactMarkdown",
      language: "markdown",
      content,
    };
  }

  // 6. CSV (consistent comma-separated lines)
  if (isLikelyCSV(content)) {
    return { id: `artifact-${++artifactCounter}`, title: "artifactCsv", language: "csv", content };
  }

  // 7. Code (contextual — only when triggered by a write/create/edit tool)
  if (toolContext?.toolName && /write|create|edit/i.test(toolContext.toolName)) {
    const ext = toolContext.filePath?.split(".").pop() ?? "";
    return {
      id: `artifact-${++artifactCounter}`,
      title: toolContext.filePath ?? "Code",
      language: "code",
      content,
      codeLang: ext,
      source: { toolName: toolContext.toolName, fileName: toolContext.filePath },
    };
  }

  return null;
}

function isLikelyCSV(content: string): boolean {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 3) {
    return false;
  }
  const counts = lines.slice(0, 5).map((l) => (l.match(/,/g) || []).length);
  return counts[0] > 0 && counts.every((c) => c === counts[0]);
}

function isLikelyMarkdown(content: string): boolean {
  const trimmed = content.trimStart();
  if (/^#{1,3}\s/.test(trimmed)) {
    return true;
  }
  const mdPatterns = /\*\*|__|\[.*\]\(.*\)|- \[[ x]\]/;
  return mdPatterns.test(content) && content.length > 80;
}
