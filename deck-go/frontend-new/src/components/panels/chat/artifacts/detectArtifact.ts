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
  codeLang?: string;
  source?: { toolName?: string; fileName?: string; filePath?: string };
}

const EXT_MAP: Record<string, ArtifactLanguage> = {
  ".html": "html",
  ".htm": "html",
  ".svg": "svg",
  ".json": "json",
  ".csv": "csv",
  ".md": "markdown",
  ".py": "code",
  ".ts": "code",
  ".js": "code",
  ".tsx": "code",
  ".jsx": "code",
  ".go": "code",
  ".rs": "code",
  ".java": "code",
  ".rb": "code",
  ".sh": "code",
  ".yaml": "code",
  ".yml": "code",
  ".xml": "code",
  ".css": "code",
  ".sql": "code",
};

export function detectArtifact(
  content: string,
  toolContext?: { toolName?: string; filePath?: string },
): ArtifactInfo | null {
  if (typeof content !== "string" || content.length < 20) {
    return null;
  }

  const filePath = toolContext?.filePath;
  const fileName = filePath ? (filePath.split("/").pop() ?? filePath) : undefined;

  if (filePath) {
    const dotIdx = filePath.lastIndexOf(".");
    if (dotIdx !== -1) {
      const ext = filePath.slice(dotIdx).toLowerCase();
      const lang = EXT_MAP[ext];
      if (lang) {
        const source = { toolName: toolContext?.toolName, fileName, filePath };
        if (lang === "json") {
          try {
            const parsed = JSON.parse(content) as unknown;
            if (parsed && typeof parsed === "object") {
              return makeArtifact(fileName ?? "JSON", "json", content, undefined, source);
            }
          } catch {
            // fall through to content heuristics
          }
        } else if (lang === "csv") {
          if (isLikelyCSV(content)) {
            return makeArtifact(fileName ?? "CSV", "csv", content, undefined, source);
          }
        } else if (lang === "code") {
          return makeArtifact(fileName ?? "Code", "code", content, ext.slice(1), source);
        } else {
          return makeArtifact(fileName ?? lang.toUpperCase(), lang, content, undefined, source);
        }
      }
    }
  }

  const imageMatch = content.match(/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/);
  if (imageMatch) {
    return makeArtifact(
      fileName ?? "Image",
      "image",
      content,
      imageMatch[1],
      toolContext ? { toolName: toolContext.toolName, fileName, filePath } : undefined,
    );
  }

  if (/<html|<body|<!doctype/i.test(content)) {
    const titleMatch = /<title>(.*?)<\/title>/i.exec(content);
    return makeArtifact(titleMatch?.[1] ?? "HTML", "html", content);
  }

  if (content.trimStart().startsWith("<svg")) {
    return makeArtifact("SVG", "svg", content);
  }

  const mermaidMatch = /```mermaid\n([\s\S]+?)```/.exec(content);
  if (mermaidMatch) {
    return makeArtifact("Diagram", "mermaid", mermaidMatch[1]);
  }

  if (content.length > 40) {
    try {
      const parsed = JSON.parse(content) as unknown;
      if (parsed && typeof parsed === "object") {
        return makeArtifact("artifactJson", "json", content);
      }
    } catch {
      // not JSON
    }
  }

  if (isLikelyMarkdown(content)) {
    return makeArtifact("artifactMarkdown", "markdown", content);
  }

  if (isLikelyCSV(content)) {
    return makeArtifact("artifactCsv", "csv", content);
  }

  if (toolContext?.toolName && /write|create|edit/i.test(toolContext.toolName)) {
    const ext = filePath?.split(".").pop() ?? "";
    return makeArtifact(fileName ?? "Code", "code", content, ext, {
      toolName: toolContext.toolName,
      fileName,
      filePath,
    });
  }

  return null;
}

function makeArtifact(
  title: string,
  language: ArtifactLanguage,
  content: string,
  codeLang?: string,
  source?: ArtifactInfo["source"],
): ArtifactInfo {
  return {
    id: stableArtifactId({ title, language, content, codeLang, source }),
    title,
    language,
    content,
    ...(codeLang ? { codeLang } : {}),
    ...(source ? { source } : {}),
  };
}

function stableArtifactId(input: {
  title: string;
  language: ArtifactLanguage;
  content: string;
  codeLang?: string;
  source?: ArtifactInfo["source"];
}) {
  const sourceKey = [
    input.source?.toolName ?? "",
    input.source?.filePath ?? "",
    input.source?.fileName ?? "",
    input.title,
    input.language,
    input.codeLang ?? "",
    input.content,
  ].join("\u001f");
  let hash = 0x811c9dc5;
  for (let index = 0; index < sourceKey.length; index++) {
    hash ^= sourceKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `artifact-${(hash >>> 0).toString(36)}`;
}

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
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 3) {
    return false;
  }
  const counts = lines.slice(0, 5).map(countCSVFields);
  return counts[0] > 1 && counts.every((count) => count === counts[0]);
}

function isLikelyMarkdown(content: string): boolean {
  const trimmed = content.trimStart();
  if (/^#{1,3}\s/.test(trimmed)) {
    return true;
  }
  if (content.length < 40) {
    return false;
  }

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
