# Deck Artifact Preview Enhancement Design

## Overview

Enhance the Deck Dashboard's artifact preview system: extract a shared rendering core used by both Canvas and Artifact panels, add download capability, and improve artifact detection accuracy.

## Problem Statement

Current artifact implementation has several limitations:

1. **Rendering code duplication** — ArtifactPanel and CanvasPanel each maintain independent rendering logic for HTML/SVG/code/JSON content, leading to inconsistent behavior and duplicated maintenance.
2. **No download** — Users cannot download artifact content as files.
3. **Detection gaps** — `detectArtifact` misses some content types (images, short markdown) and doesn't leverage file extension hints from tool inputs.
4. **No image support** — Base64 images in tool results are not detected or rendered as artifacts.

## Design Decisions

### Scope: chat stream content only

Artifact preview covers content already received in the browser via the chat stream (tool_use/tool_result blocks). Local filesystem files produced by the agent are out of scope — users handle those via native OS tools (Finder, Explorer). Channel users receive files through their respective plugins (WeCom, Telegram, etc.).

### No ArtifactStore, no artifact list

Artifacts are NOT collected into a separate store. The chat message stream itself serves as the artifact "directory" — users scroll through messages and click ArtifactCard to preview. This keeps the architecture simple and avoids maintaining a parallel index that must stay in sync with the message stream.

### Canvas and Artifact: shared rendering core, separate panels

Canvas (agent-driven) and Artifact (user-driven) share the same `SharedRenderer` component but remain separate panels in the right sidebar, switching via mutual exclusion. This avoids the conflict where an agent A2UI push would overwrite a user's file preview within a single panel.

## Architecture

### Component Hierarchy

```
ChatPanel
  ├── MessageList
  │     └── ToolResultCard
  │           └── ArtifactCard (thumbnail + "Open" button)
  │                 → click: setActiveArtifact + rightPanelMode="artifact"
  │
  ├── RightPanel (mode: "canvas" | "artifact" | "hidden")
  │     ├── CanvasPanel (agent-driven)
  │     │     └── A2UI Bridge + SharedRenderer (for non-A2UI static content)
  │     │
  │     └── ArtifactPanel (user-driven)
  │           └── Toolbar (close/download/copy/fullscreen) + SharedRenderer
  │
  └── MessageInput
        ├── Canvas toggle
        └── Artifact toggle
```

### Layer Responsibilities

| Layer            | Responsibility                                                   | Driver                              |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------- |
| `SharedRenderer` | Pure rendering: receives `{ type, content }`, outputs preview UI | Stateless, called by consumers      |
| `CanvasPanel`    | A2UI bridge + canvas command consumption + calls SharedRenderer  | Agent (via node.invoke)             |
| `ArtifactPanel`  | Toolbar (download/copy/fullscreen/close) + calls SharedRenderer  | User (click to open)                |
| `detectArtifact` | Content analysis: detect artifact type from tool result text     | Called during ToolResultCard render |

## SharedRenderer Component

SharedRenderer is a pure rendering component — it receives content and outputs the appropriate preview UI. It does NOT own the toolbar. Each consumer (ArtifactPanel, CanvasPanel) provides its own toolbar/chrome around the SharedRenderer.

### Interface

```typescript
interface SharedRendererProps {
  artifact: ArtifactInfo;
  className?: string;
}
```

### Rendering Routes

| `language`                 | Renderer                   | Method                                    |
| -------------------------- | -------------------------- | ----------------------------------------- |
| `html` / `svg` / `mermaid` | iframe (sandbox + srcdoc)  | `buildSrcdoc()`                           |
| `json`                     | JsonTree                   | Interactive collapsible tree              |
| `csv`                      | TableViewer                | HTML table                                |
| `markdown`                 | MarkdownViewer             | Streamdown rendering                      |
| `code`                     | CodeViewer                 | Syntax-highlighted code with line numbers |
| `image`                    | `<img>` tag                | Direct rendering from data URI            |
| `text`                     | iframe (plain text srcdoc) | Monospace text                            |

### Consumer Responsibilities

- **ArtifactPanel**: Owns toolbar (close, download, copy, fullscreen buttons) + renders `<SharedRenderer artifact={activeArtifact} />`
- **CanvasPanel**: Unchanged in this iteration. CanvasPanel remains fully A2UI/iframe-based. SharedRenderer integration with CanvasPanel is deferred — it can be added later when a concrete use case arises (e.g., `canvas.present` with inline content rather than a URL). The value of SharedRenderer extraction is immediate for ArtifactPanel and prevents future duplication when CanvasPanel needs it.

### Download Implementation

```typescript
const EXTENSION_MAP: Record<ArtifactLanguage, string> = {
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

const MIME_MAP: Record<ArtifactLanguage, string> = {
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

function downloadArtifact(artifact: ArtifactInfo): void {
  const filename =
    artifact.source?.fileName || artifact.title || `artifact.${EXTENSION_MAP[artifact.language]}`;

  if (artifact.language === "image") {
    // artifact.content for images is always a full data URI: "data:image/png;base64,..."
    // Extract MIME and base64 payload from the URI.
    const match = artifact.content.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) return;
    const mime = match[1]; // e.g., "image/png", "image/jpeg"
    const base64 = match[2];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    triggerDownload(blob, filename);
  } else {
    const blob = new Blob([artifact.content], { type: MIME_MAP[artifact.language] });
    triggerDownload(blob, filename);
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

## File Structure Changes

### Before

```
panels/chat/
├── artifacts/
│   ├── detectArtifact.ts
│   ├── ArtifactPanel.tsx        ← rendering + toolbar combined
│   ├── ArtifactCard.tsx
│   ├── CodeViewer.tsx           ← viewer components here
│   ├── MarkdownViewer.tsx
│   ├── JsonTree.tsx
│   └── TableViewer.tsx
├── CanvasPanel.tsx              ← independent rendering
└── ...
```

### After

```
panels/chat/
├── shared-renderer/              ← NEW: shared rendering core
│   ├── SharedRenderer.tsx        ← pure render routing (no toolbar)
│   ├── download.ts               ← download logic (consumed by ArtifactPanel toolbar)
│   ├── srcdoc.ts                 ← buildSrcdoc (moved from ArtifactPanel)
│   ├── CodeViewer.tsx            ← moved from artifacts/
│   ├── MarkdownViewer.tsx        ← moved from artifacts/
│   ├── JsonTree.tsx              ← moved from artifacts/
│   └── TableViewer.tsx           ← moved from artifacts/
├── artifacts/
│   ├── detectArtifact.ts         ← enhanced detection
│   ├── ArtifactPanel.tsx         ← simplified: toolbar + <SharedRenderer>
│   └── ArtifactCard.tsx          ← unchanged
├── CanvasPanel.tsx               ← unchanged in this iteration
├── RightPanel.tsx                ← unchanged (already supports "canvas"|"artifact"|"hidden")
└── ...
```

## detectArtifact Enhancements

### Updated Detection Flow (priority order)

The detection function signature is unchanged: `detectArtifact(content: string, toolContext?: { toolName?: string; filePath?: string })`. Callers (`ToolResultCard`) require no changes — `filePath` is already accepted in `toolContext` but was previously unused for type detection. The change is internal: `filePath` is now used for extension-based detection and is passed through to the returned `ArtifactInfo.source.filePath`.

**New detection order:**

1. **Content too short** — if `content.length < 20`, return null (unchanged)
2. **File extension priority** — if `toolContext.filePath` has a known extension in `EXT_MAP`, use it as the detected language. For `json` and `csv`, still validate the content (parse JSON / check column consistency) to avoid false positives from misnamed files. For other types, trust the extension.
3. **Image detection** — match `data:image/(png|jpeg|gif|webp|svg+xml);base64,...` pattern. Store the full data URI as `content` (not stripped). The `codeLang` field stores the image subtype (e.g., `"png"`, `"jpeg"`) for correct download MIME and extension.
4. **Content heuristics** (existing, in order): HTML → SVG → Mermaid → JSON → Markdown → CSV → Code
5. **Relaxed Markdown** — lower threshold from ≥80 chars + ≥2 patterns to ≥40 chars + ≥1 pattern. Trade-off: may produce occasional false positives on short tool outputs with a single bold word or list item. Acceptable because the ArtifactCard "Open" button is non-intrusive — a false positive just shows an extra clickable card, not a forced preview.

### File Extension Map

```typescript
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
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".bmp": "image",
};
```

### ArtifactCard Title Improvement

- Has `filePath` → show filename extracted from path (e.g., `index.html`, `data.json`)
- No filePath → show type label (e.g., "HTML Preview", "JSON Data", "Code")

### Updated ArtifactInfo Interface

```typescript
interface ArtifactInfo {
  id: string;
  title: string;
  language: ArtifactLanguage;
  content: string; // For image: full data URI (data:image/...;base64,...)
  codeLang?: string; // For code: file extension; for image: subtype (png/jpeg/etc.)
  source?: {
    toolName?: string;
    fileName?: string;
    filePath?: string; // NEW: full path from tool_use.input
  };
}

type ArtifactLanguage =
  | "html"
  | "svg"
  | "mermaid"
  | "json"
  | "csv"
  | "markdown"
  | "code"
  | "text"
  | "image"; // NEW
```

## Mutual Exclusion Rules

Right panel mode transitions:

| Trigger                                     | Result                                  |
| ------------------------------------------- | --------------------------------------- |
| User clicks ArtifactCard "Open"             | `mode → "artifact"`                     |
| User clicks Artifact toggle button          | `mode: "artifact" ↔ "hidden"`           |
| Agent pushes `canvas.present` / `a2ui.push` | `mode → "canvas"` (overrides artifact)  |
| User clicks Canvas toggle button            | `mode: "canvas" ↔ "hidden"`             |
| User closes right panel                     | `mode → "hidden"`                       |
| Session switch                              | `mode → "hidden"`, clear activeArtifact |

When the user is viewing an artifact and the agent pushes Canvas content, the panel switches to Canvas. This is intentional — agent pushes indicate content requiring immediate attention. The user can reopen the artifact from the chat message after closing Canvas.

## Interaction Flow

```
1. Agent calls write tool → creates an HTML file
2. ToolResultCard renders → detectArtifact detects HTML (via extension or content)
3. ArtifactCard displays: "index.html [Open]"
4. User clicks Open → right panel switches to artifact mode
5. SharedRenderer renders HTML in sandboxed iframe
6. User clicks download → browser downloads index.html
7. Agent pushes canvas.a2ui.push → right panel auto-switches to canvas mode
8. User finishes Canvas interaction, closes panel → hidden
9. User scrolls back to ArtifactCard, clicks Open → preview again
```

## Testing Strategy

- **SharedRenderer**: Unit tests for each render route (HTML/JSON/CSV/markdown/code/image)
- **Download**: Unit test for blob creation and filename generation per type
- **detectArtifact**: Extend existing test suite with file extension priority, relaxed markdown, image detection
- **Integration**: Verify ArtifactCard → ArtifactPanel → SharedRenderer flow
- **Mutual exclusion**: Verify panel mode transitions (artifact ↔ canvas ↔ hidden)

## Out of Scope

- Local filesystem browsing (users use OS tools)
- ArtifactStore / artifact list panel (chat stream is the list)
- Cross-session artifact persistence
- Artifact indexing or search
- Channel file delivery (handled by channel plugins)
