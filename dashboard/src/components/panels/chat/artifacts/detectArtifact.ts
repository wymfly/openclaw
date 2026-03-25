export type ArtifactLanguage =
  | "html"
  | "svg"
  | "mermaid"
  | "json"
  | "csv"
  | "markdown"
  | "code"
  | "text"
  | "image";

export interface ArtifactInfo {
  id: string;
  title: string;
  language: ArtifactLanguage;
  content: string;
  /** For code: file extension; for image: subtype (png/jpeg/etc.) */
  codeLang?: string;
  /** Source context. */
  source?: { toolName?: string; fileName?: string; filePath?: string };
}

let artifactCounter = 0;

const EXT_MAP: Record<string, ArtifactLanguage> = {
  ".html": "html", ".htm": "html",
  ".svg": "svg",
  ".json": "json",
  ".csv": "csv",
  ".md": "markdown",
  ".py": "code", ".ts": "code", ".js": "code", ".tsx": "code",
  ".jsx": "code", ".go": "code", ".rs": "code", ".java": "code",
  ".rb": "code", ".sh": "code", ".yaml": "code", ".yml": "code",
  ".xml": "code", ".css": "code", ".sql": "code",
};

export function detectArtifact(
  content: string,
  toolContext?: { toolName?: string; filePath?: string },
): ArtifactInfo | null {
  if (typeof content !== "string" || content.length < 20) {
    return null;
  }

  const filePath = toolContext?.filePath;
  const fileName = filePath ? filePath.split("/").pop() ?? filePath : undefined;

  // 1. File extension priority
  if (filePath) {
    const dotIdx = filePath.lastIndexOf(".");
    if (dotIdx !== -1) {
      const ext = filePath.slice(dotIdx).toLowerCase();
      const lang = EXT_MAP[ext];
      if (lang) {
        if (lang === "json") {
          try {
            const parsed = JSON.parse(content);
            if (typeof parsed === "object" && parsed !== null) {
              return {
                id: `artifact-${++artifactCounter}`,
                title: fileName ?? "JSON",
                language: "json",
                content,
                source: { toolName: toolContext?.toolName, fileName, filePath },
              };
            }
          } catch { /* fall through */ }
        } else if (lang === "csv") {
          if (isLikelyCSV(content)) {
            return {
              id: `artifact-${++artifactCounter}`,
              title: fileName ?? "CSV",
              language: "csv",
              content,
              source: { toolName: toolContext?.toolName, fileName, filePath },
            };
          }
        } else if (lang === "code") {
          const codeExt = ext.slice(1);
          return {
            id: `artifact-${++artifactCounter}`,
            title: fileName ?? "Code",
            language: "code",
            content,
            codeLang: codeExt,
            source: { toolName: toolContext?.toolName, fileName, filePath },
          };
        } else {
          return {
            id: `artifact-${++artifactCounter}`,
            title: fileName ?? lang.toUpperCase(),
            language: lang,
            content,
            source: { toolName: toolContext?.toolName, fileName, filePath },
          };
        }
      }
    }
  }

  // 2. Image detection (base64 data URI)
  const imageMatch = content.match(/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/);
  if (imageMatch) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "Image",
      language: "image",
      content,
      codeLang: imageMatch[1],
    };
  }

  // 3. Content heuristics (existing order)
  if (/<html|<body|<!doctype/i.test(content)) {
    const titleMatch = /<title>(.*?)<\/title>/i.exec(content);
    return {
      id: `artifact-${++artifactCounter}`,
      title: titleMatch?.[1] ?? "HTML",
      language: "html",
      content,
    };
  }

  if (content.trimStart().startsWith("<svg")) {
    return { id: `artifact-${++artifactCounter}`, title: "SVG", language: "svg", content };
  }

  const mermaidMatch = /```mermaid\n([\s\S]+?)```/.exec(content);
  if (mermaidMatch) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "Diagram",
      language: "mermaid",
      content: mermaidMatch[1],
    };
  }

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
    } catch { /* not JSON */ }
  }

  if (isLikelyMarkdown(content)) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "artifactMarkdown",
      language: "markdown",
      content,
    };
  }

  if (isLikelyCSV(content)) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "artifactCsv",
      language: "csv",
      content,
    };
  }

  if (toolContext?.toolName && /write|create|edit/i.test(toolContext.toolName)) {
    const ext = filePath?.split(".").pop() ?? "";
    return {
      id: `artifact-${++artifactCounter}`,
      title: fileName ?? "Code",
      language: "code",
      content,
      codeLang: ext,
      source: { toolName: toolContext.toolName, fileName, filePath },
    };
  }

  return null;
}

/** Count logical CSV fields in a line, respecting quoted fields. */
function countCSVFields(line: string): number {
  let count = 1;
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      count++;
    }
  }
  return count;
}

function isLikelyCSV(content: string): boolean {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 3) {
    return false;
  }
  const counts = lines.slice(0, 5).map(countCSVFields);
  return counts[0] > 1 && counts.every((c) => c === counts[0]);
}

function isLikelyMarkdown(content: string): boolean {
  const trimmed = content.trimStart();
  // Heading at start is a strong signal on its own
  if (/^#{1,3}\s/.test(trimmed)) {
    return true;
  }
  if (content.length < 40) {
    return false;
  }
  // Require at least 1 distinct markdown pattern for non-heading content
  let patterns = 0;
  if (/\*\*[^*]+\*\*/.test(content)) {
    patterns++;
  }
  if (/__[^_]+__/.test(content)) {
    patterns++;
  }
  if (/\[.+\]\(.+\)/.test(content)) {
    patterns++;
  }
  if (/- \[[ x]\]/.test(content)) {
    patterns++;
  }
  if (/^[-*+]\s/m.test(content)) {
    patterns++;
  }
  if (/^\d+\.\s/m.test(content)) {
    patterns++;
  }
  if (/^>\s/m.test(content)) {
    patterns++;
  }
  if (/```[\s\S]*?```/.test(content)) {
    patterns++;
  }
  return patterns >= 1;
}
