# Artifact Preview Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared rendering core from the artifact system, add download capability, and enhance artifact detection with file extension priority and image support.

**Architecture:** Extract viewer components (CodeViewer, JsonTree, MarkdownViewer, TableViewer) and srcdoc builder into a new `shared-renderer/` directory. Simplify ArtifactPanel to toolbar + SharedRenderer. Enhance detectArtifact with a file-extension-first detection flow and new image type. CanvasPanel unchanged this iteration.

**Tech Stack:** React, TypeScript, Next.js (next-intl for i18n), Vitest for testing

**Skill dependencies:**

| Domain | Skills |
|--------|--------|
| `[frontend]` | `frontend-design`, `superpowers:test-driven-development` |

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `dashboard/src/components/panels/chat/shared-renderer/SharedRenderer.tsx` | Pure render routing — receives ArtifactInfo, outputs preview UI |
| Create | `dashboard/src/components/panels/chat/shared-renderer/download.ts` | Download logic (triggerDownload, EXTENSION_MAP, MIME_MAP) |
| Create | `dashboard/src/components/panels/chat/shared-renderer/srcdoc.ts` | buildSrcdoc + usesIframe (moved from ArtifactPanel) |
| Move | `dashboard/src/components/panels/chat/shared-renderer/CodeViewer.tsx` | Moved from `artifacts/CodeViewer.tsx` |
| Move | `dashboard/src/components/panels/chat/shared-renderer/MarkdownViewer.tsx` | Moved from `artifacts/MarkdownViewer.tsx` |
| Move | `dashboard/src/components/panels/chat/shared-renderer/JsonTree.tsx` | Moved from `artifacts/JsonTree.tsx` |
| Move | `dashboard/src/components/panels/chat/shared-renderer/TableViewer.tsx` | Moved from `artifacts/TableViewer.tsx` |
| Modify | `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx` | Simplify to toolbar + SharedRenderer |
| Modify | `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts` | Add ArtifactLanguage export, EXT_MAP, image detection, relaxed markdown, filePath in source |
| Modify | `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx` | Pass filePath to detectArtifact |
| Modify | `dashboard/src/i18n/zh.json` | Add download button key |
| Modify | `dashboard/src/i18n/en.json` | Add download button key |
| Create | `dashboard/src/components/panels/chat/shared-renderer/__tests__/download.test.ts` | Unit tests for download logic |
| Modify | `dashboard/src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts` | Add extension priority + image tests |

---

### Task 1: Export ArtifactLanguage type + move viewer components to shared-renderer

Export the `ArtifactLanguage` type from `detectArtifact.ts` (needed by SharedRenderer and download.ts in later tasks), add `"image"` to the union. Then move the four viewer components and srcdoc builder from `artifacts/` to `shared-renderer/`, updating all import paths.

**Files:**
- Create: `dashboard/src/components/panels/chat/shared-renderer/srcdoc.ts`
- Create: `dashboard/src/components/panels/chat/shared-renderer/CodeViewer.tsx`
- Create: `dashboard/src/components/panels/chat/shared-renderer/MarkdownViewer.tsx`
- Create: `dashboard/src/components/panels/chat/shared-renderer/JsonTree.tsx`
- Create: `dashboard/src/components/panels/chat/shared-renderer/TableViewer.tsx`
- Delete: `dashboard/src/components/panels/chat/artifacts/CodeViewer.tsx`
- Delete: `dashboard/src/components/panels/chat/artifacts/MarkdownViewer.tsx`
- Delete: `dashboard/src/components/panels/chat/artifacts/JsonTree.tsx`
- Delete: `dashboard/src/components/panels/chat/artifacts/TableViewer.tsx`
- Modify: `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx` (update imports)

- [ ] **Step 1: Export ArtifactLanguage type and add "image"**

In `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts`, extract the language union into a named exported type and add `"image"`. Update `ArtifactInfo` to use it and add `filePath` to `source`:

```typescript
// At the top of detectArtifact.ts, replace the interface:
export type ArtifactLanguage =
  | "html" | "svg" | "mermaid"
  | "json" | "csv" | "markdown"
  | "code" | "text"
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
```

- [ ] **Step 2: Create `srcdoc.ts`**

Extract `buildSrcdoc` and `usesIframe` from `ArtifactPanel.tsx:19-35` into a new file:

```typescript
// dashboard/src/components/panels/chat/shared-renderer/srcdoc.ts
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
```

- [ ] **Step 3: Move viewer components**

Copy the four viewer files from `artifacts/` to `shared-renderer/`, keeping content identical:
- `artifacts/CodeViewer.tsx` → `shared-renderer/CodeViewer.tsx`
- `artifacts/MarkdownViewer.tsx` → `shared-renderer/MarkdownViewer.tsx`
- `artifacts/JsonTree.tsx` → `shared-renderer/JsonTree.tsx`
- `artifacts/TableViewer.tsx` → `shared-renderer/TableViewer.tsx`

Delete the originals from `artifacts/`.

- [ ] **Step 4: Update ArtifactPanel imports**

In `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx`, update imports to point to the new locations:

```typescript
// Before:
import { CodeViewer } from "./CodeViewer";
import { JsonTree } from "./JsonTree";
import { MarkdownViewer } from "./MarkdownViewer";
import { TableViewer } from "./TableViewer";

// After:
import { buildSrcdoc, usesIframe } from "../shared-renderer/srcdoc";
import { CodeViewer } from "../shared-renderer/CodeViewer";
import { JsonTree } from "../shared-renderer/JsonTree";
import { MarkdownViewer } from "../shared-renderer/MarkdownViewer";
import { TableViewer } from "../shared-renderer/TableViewer";
```

Remove the local `buildSrcdoc` and `usesIframe` functions from `ArtifactPanel.tsx` (lines 18-35) since they're now imported.

- [ ] **Step 5: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: zero errors (all imports resolve correctly)

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/chat/shared-renderer/ dashboard/src/components/panels/chat/artifacts/
git commit -m "[enhanced] refactor: extract shared-renderer from artifact viewers"
```

---

### Task 2: Create SharedRenderer component

Create the pure rendering component that routes to the correct viewer based on artifact language.

**Files:**
- Create: `dashboard/src/components/panels/chat/shared-renderer/SharedRenderer.tsx`

- [ ] **Step 1: Create SharedRenderer**

```typescript
// dashboard/src/components/panels/chat/shared-renderer/SharedRenderer.tsx
"use client";

import { useMemo } from "react";
import type { ArtifactInfo } from "../artifacts/detectArtifact";
import { CodeViewer } from "./CodeViewer";
import { JsonTree } from "./JsonTree";
import { MarkdownViewer } from "./MarkdownViewer";
import { TableViewer } from "./TableViewer";
import { buildSrcdoc, usesIframe } from "./srcdoc";

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
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add -f dashboard/src/components/panels/chat/shared-renderer/SharedRenderer.tsx
git commit -m "[enhanced] feat(deck): create SharedRenderer component"
```

---

### Task 3: Simplify ArtifactPanel to toolbar + SharedRenderer

Replace the inline rendering logic in ArtifactPanel with a SharedRenderer call, and add a download button.

**Files:**
- Modify: `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx`
- Create: `dashboard/src/components/panels/chat/shared-renderer/download.ts`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`
- Test: `dashboard/src/components/panels/chat/shared-renderer/__tests__/download.test.ts`

- [ ] **Step 1: Write download test**

```typescript
// dashboard/src/components/panels/chat/shared-renderer/__tests__/download.test.ts
import { describe, it, expect } from "vitest";
import { buildDownloadFilename, EXTENSION_MAP, MIME_MAP } from "../download";

describe("download", () => {
  it("uses source.fileName when available", () => {
    expect(
      buildDownloadFilename({
        id: "1",
        title: "test",
        language: "html",
        content: "",
        source: { fileName: "page.html" },
      }),
    ).toBe("page.html");
  });

  it("falls back to title", () => {
    expect(
      buildDownloadFilename({ id: "1", title: "My Report", language: "json", content: "" }),
    ).toBe("My Report");
  });

  it("falls back to artifact.{ext}", () => {
    expect(
      buildDownloadFilename({ id: "1", title: "", language: "csv", content: "" }),
    ).toBe("artifact.csv");
  });

  it("has entries for all languages in EXTENSION_MAP", () => {
    const languages = ["html", "svg", "mermaid", "json", "csv", "markdown", "code", "text", "image"];
    for (const lang of languages) {
      expect(EXTENSION_MAP).toHaveProperty(lang);
      expect(MIME_MAP).toHaveProperty(lang);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/components/panels/chat/shared-renderer/__tests__/download.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create download.ts**

```typescript
// dashboard/src/components/panels/chat/shared-renderer/download.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run src/components/panels/chat/shared-renderer/__tests__/download.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Add i18n keys**

In `dashboard/src/i18n/zh.json`, in the `chat` section, add:
```json
"artifactDownload": "下载"
```

In `dashboard/src/i18n/en.json`, in the `chat` section, add:
```json
"artifactDownload": "Download"
```

- [ ] **Step 6: Rewrite ArtifactPanel**

Replace the content of `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx`:

```typescript
"use client";
import { Copy, Check, Download, X, Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SharedRenderer } from "../shared-renderer/SharedRenderer";
import { downloadArtifact } from "../shared-renderer/download";
import type { ArtifactInfo } from "./detectArtifact";

interface ArtifactPanelProps {
  artifact: ArtifactInfo;
  onClose: () => void;
}

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-[var(--card)]",
        fullscreen ? "fixed inset-0 z-50 border border-[var(--border)]" : "h-full",
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] shrink-0">
        <span className="flex-1 text-xs font-medium text-[var(--foreground)] truncate">
          {t.has(artifact.title) ? t(artifact.title) : artifact.title}
        </span>
        <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
          {artifact.language}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => downloadArtifact(artifact)}
          title={t("artifactDownload")}
          className="cursor-pointer"
        >
          <Download size={12} />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleCopy}
          title={t("artifactCopy")}
          className="cursor-pointer"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setFullscreen(!fullscreen)}
          title={t("artifactFullscreen")}
          className="cursor-pointer"
        >
          <Maximize2 size={12} />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onClose}
          title={t("artifactClose")}
          className="cursor-pointer"
        >
          <X size={12} />
        </Button>
      </div>

      {/* Content — delegated to SharedRenderer */}
      <SharedRenderer artifact={artifact} />
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 8: Commit**

```bash
git add -f dashboard/src/components/panels/chat/shared-renderer/download.ts \
  dashboard/src/components/panels/chat/shared-renderer/__tests__/download.test.ts \
  dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx \
  dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): simplify ArtifactPanel with SharedRenderer + download"
```

---

### Task 4: Enhance detectArtifact — file extension priority + image detection

Add file-extension-based detection as the highest priority path, add image type support, relax markdown threshold, and pass `filePath` through to the returned ArtifactInfo.

**Files:**
- Modify: `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts`
- Modify: `dashboard/src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`

- [ ] **Step 1: Write new tests**

Append to `dashboard/src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`:

```typescript
  // --- Extension priority tests ---

  it("detects language from .html extension", () => {
    const result = detectArtifact("some generic content that is long enough to pass the minimum length check", {
      toolName: "write",
      filePath: "/tmp/output.html",
    });
    expect(result?.language).toBe("html");
    expect(result?.source?.filePath).toBe("/tmp/output.html");
  });

  it("detects code from .py extension", () => {
    const result = detectArtifact("def hello():\n    print('hello world')\n    return True", {
      toolName: "write",
      filePath: "script.py",
    });
    expect(result?.language).toBe("code");
    expect(result?.codeLang).toBe("py");
  });

  it("validates JSON even with .json extension", () => {
    const result = detectArtifact("this is not json but long enough to pass twenty chars", {
      toolName: "write",
      filePath: "data.json",
    });
    // Should fall through to content heuristics since content is not valid JSON
    expect(result?.language).not.toBe("json");
  });

  it("uses extension title from filePath", () => {
    const result = detectArtifact("body { color: red; }\n.container { display: flex; }", {
      toolName: "write",
      filePath: "/app/styles/main.css",
    });
    expect(result?.title).toBe("main.css");
  });

  // --- Image detection tests ---

  it("detects base64 PNG image", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk";
    const result = detectArtifact(dataUri);
    expect(result?.language).toBe("image");
    expect(result?.codeLang).toBe("png");
    expect(result?.content).toBe(dataUri);
  });

  it("detects base64 JPEG image", () => {
    const dataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJ";
    const result = detectArtifact(dataUri);
    expect(result?.language).toBe("image");
    expect(result?.codeLang).toBe("jpeg");
  });

  // --- Relaxed markdown tests ---

  it("detects markdown with single bold pattern and 40+ chars", () => {
    const md = "This text has **one bold section** and is long enough to be useful content.";
    expect(detectArtifact(md)?.language).toBe("markdown");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`
Expected: FAIL — new tests fail (no extension detection, no image type, markdown threshold too high)

- [ ] **Step 3: Update ArtifactInfo type**

In `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts`, update the interface and type:

```typescript
export type ArtifactLanguage =
  | "html" | "svg" | "mermaid"
  | "json" | "csv" | "markdown"
  | "code" | "text"
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
```

- [ ] **Step 4: Add EXT_MAP and image detection to detectArtifact**

Replace the `detectArtifact` function body with the new detection flow:

```typescript
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
  // Note: image extensions (.png, .jpg, etc.) are NOT in EXT_MAP.
  // Extension-based image detection is skipped because file content from
  // write tools is raw text/binary, not a data URI that <img> can render.
  // Image artifacts are only detected via data URI content (step 2).
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
        // For json/csv, validate content to avoid false positives
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
          const codeExt = ext.slice(1); // remove dot
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
      codeLang: imageMatch[1], // subtype: "png", "jpeg", "gif", etc.
    };
  }

  // 3. Content heuristics (existing logic, unchanged order)
  // 3a. HTML
  if (/<html|<body|<!doctype/i.test(content)) {
    const titleMatch = /<title>(.*?)<\/title>/i.exec(content);
    return {
      id: `artifact-${++artifactCounter}`,
      title: titleMatch?.[1] ?? "HTML",
      language: "html",
      content,
    };
  }

  // 3b. SVG
  if (content.trimStart().startsWith("<svg")) {
    return { id: `artifact-${++artifactCounter}`, title: "SVG", language: "svg", content };
  }

  // 3c. Mermaid
  const mermaidMatch = /```mermaid\n([\s\S]+?)```/.exec(content);
  if (mermaidMatch) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "Diagram",
      language: "mermaid",
      content: mermaidMatch[1],
    };
  }

  // 3d. JSON
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

  // 3e. Markdown
  if (isLikelyMarkdown(content)) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "artifactMarkdown",
      language: "markdown",
      content,
    };
  }

  // 3f. CSV
  if (isLikelyCSV(content)) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "artifactCsv",
      language: "csv",
      content,
    };
  }

  // 3g. Code (contextual)
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
```

- [ ] **Step 5: Relax markdown threshold**

In the `isLikelyMarkdown` function, change the length check from `content.length < 80` to `content.length < 40` and the pattern count from `patterns >= 2` to `patterns >= 1`:

```typescript
function isLikelyMarkdown(content: string): boolean {
  const trimmed = content.trimStart();
  if (/^#{1,3}\s/.test(trimmed)) {
    return true;
  }
  if (content.length < 40) {
    return false;
  }
  let patterns = 0;
  if (/\*\*[^*]+\*\*/.test(content)) patterns++;
  if (/__[^_]+__/.test(content)) patterns++;
  if (/\[.+\]\(.+\)/.test(content)) patterns++;
  if (/- \[[ x]\]/.test(content)) patterns++;
  if (/^[-*+]\s/m.test(content)) patterns++;
  if (/^\d+\.\s/m.test(content)) patterns++;
  if (/^>\s/m.test(content)) patterns++;
  if (/```[\s\S]*?```/.test(content)) patterns++;
  return patterns >= 1;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Update the existing test for relaxed markdown**

The existing test at line 52-56 ("rejects text with only one markdown pattern") now expects detection since threshold is lowered. Update it:

```typescript
  it("detects text with one markdown pattern when long enough (relaxed threshold)", () => {
    const prose =
      "This is some normal text that happens to contain **one bold phrase** but nothing else that looks like markdown formatting at all in this line.";
    expect(detectArtifact(prose)?.language).toBe("markdown");
  });
```

- [ ] **Step 8: Run full test suite**

Run: `cd dashboard && npx vitest run src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`
Expected: ALL PASS

- [ ] **Step 9: Update ToolResultCard to pass filePath**

In `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`, update the `detectArtifact` call to pass `filePath` from the tool input. Find the line that calls `detectArtifact(contentStr, toolName ? { toolName } : undefined)` and change it to:

```typescript
const filePath = typeof toolInput?.file_path === "string"
  ? toolInput.file_path
  : typeof toolInput?.path === "string"
    ? toolInput.path
    : undefined;
const artifact = !isError
  ? detectArtifact(contentStr, toolName ? { toolName, filePath } : undefined)
  : null;
```

This ensures file extension priority detection actually receives the filePath at runtime.

- [ ] **Step 10: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 11: Commit**

```bash
git add dashboard/src/components/panels/chat/artifacts/detectArtifact.ts \
  dashboard/src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts \
  dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx
git commit -m "[enhanced] feat(deck): enhance detectArtifact with extension priority + image support"
```

---

### Task 5: Integration verification

Verify the full flow works end-to-end: tsc, all tests, lint.

**Files:**
- No new files — verification only

- [ ] **Step 1: Type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 2: Run all artifact-related tests**

Run: `cd dashboard && npx vitest run src/components/panels/chat`
Expected: ALL PASS

- [ ] **Step 3: Verify no import breakage in other consumers**

Search for any remaining imports of old paths:

Run: `grep -r "from.*artifacts/CodeViewer\|from.*artifacts/JsonTree\|from.*artifacts/MarkdownViewer\|from.*artifacts/TableViewer" dashboard/src/`
Expected: no matches (all moved to shared-renderer/)

- [ ] **Step 4: Commit if any fixes needed**

If Steps 1-3 revealed issues, fix them and commit:
```bash
git commit -m "[enhanced] fix(deck): resolve integration issues from artifact refactor"
```
