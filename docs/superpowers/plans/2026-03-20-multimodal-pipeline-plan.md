# Multimodal Pipeline Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the core multimodal pipeline so chat.send RPC achieves channel-parity — files reach Agent workspace, media understanding runs automatically, tool/approval/A2UI events reach Dashboard, and WeCom's proven enhancements are upstreamed to core.

**Architecture:** Three layers: (1) Push WeCom text-preview/error-notification/MIME enhancements to core `media-understanding/apply.ts`, (2) Wire chat.send to save attachments to disk and fill `MsgContext.MediaPath` so the unified `getReplyFromConfig → applyMediaUnderstanding` pipeline handles them, (3) Dashboard declares proper capabilities/scopes to receive tool events, approvals, and A2UI events.

**Tech Stack:** Node.js (TypeScript), Gateway RPC, Pi SDK, Zustand, React 19, next-intl.

**Design Spec:** `docs/superpowers/specs/2026-03-20-multimodal-pipeline-design.md`

---

## File Structure

| File                                                         | Responsibility                                                  | Action                           |
| ------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------- |
| `src/media-understanding/apply.ts`                           | Core media pipeline — text heuristic + error notification       | Modify                           |
| `src/media/mime.ts`                                          | MIME ↔ extension mapping                                        | Modify (add missing audio types) |
| `src/gateway/server-methods/chat.ts`                         | chat.send RPC — save to disk + MediaPath + remove images bypass | Modify                           |
| `src/gateway/protocol/schema/logs-chat.ts`                   | ChatEventSchema — add media fields                              | Modify                           |
| `src/gateway/server-chat.ts`                                 | emitChatFinal — fill media fields                               | Modify                           |
| `src/gateway/server-methods/nodes.handlers.invoke-result.ts` | A2UI event broadcast from node.invoke result                    | Modify                           |
| `src/agents/pi-embedded-runner/run/images.ts`                | Vision model fallback warning                                   | Modify                           |
| `extensions/wecom/src/agent/handler.ts`                      | Remove upstreamed code                                          | Modify                           |
| `dashboard/server/gateway-adapter.ts` (or equivalent)        | Add tool-events cap + operator.approvals scope                  | Modify                           |
| `dashboard/src/components/panels/chat/useChatSSE.ts`         | Listen to agent/approval/a2ui events                            | Modify                           |
| `dashboard/src/components/panels/chat/ChatPanel.tsx`         | ApprovalDialog integration                                      | Modify                           |
| `dashboard/src/components/panels/chat/ApprovalDialog.tsx`    | New approval UI component                                       | Create                           |
| `dashboard/src/i18n/zh.json` + `en.json`                     | Approval dialog i18n keys                                       | Modify                           |

---

### Task 1: Core pipeline — text heuristic for binary-classified files + error notification + MIME gaps

**Context:** `src/media-understanding/apply.ts` line 381 skips files when `isBinaryMediaMime()` returns true. WeCom proved that sampling 4096 bytes and checking ≤2% non-printable chars catches text files misclassified as binary (e.g., `.log`, `.cfg` with `application/octet-stream`). Also, all catch blocks in file extraction silently skip — users never know why their file wasn't processed.

**Files:**

- Modify: `src/media-understanding/apply.ts`
- Modify: `src/media/mime.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add missing MIME mappings to `src/media/mime.ts`**

In `EXT_BY_MIME`, add after the existing audio entries (~line 16):

```typescript
"audio/amr": ".amr",
"audio/speex": ".speex",
"audio/opus": ".opus",
```

In `MIME_BY_EXT` additional aliases section (~line 41), add:

```typescript
".amr": "audio/amr",
".speex": "audio/speex",
".opus": "audio/opus",
```

- [ ] **Step 2: Add text heuristic to `apply.ts` `extractFileBlocks()`**

At line 381, where `isBinaryMediaMime` causes a `continue`, add a second-chance check using the buffer:

```typescript
// Line 381 — currently: if (!forcedTextMimeResolved && isBinaryMediaMime(normalizedRawMime)) { continue; }
// Change to:
if (!forcedTextMimeResolved && isBinaryMediaMime(normalizedRawMime)) {
  // Second-chance: check if buffer content actually looks like text
  // (catches .log, .cfg, etc. misclassified as application/octet-stream)
  if (!bufferResult?.buffer || !looksLikeTextContent(bufferResult.buffer)) {
    continue;
  }
  // Override MIME to text/plain for downstream processing
  logVerbose(
    `media: binary MIME "${normalizedRawMime}" overridden to text/plain (text heuristic) index=${attachment.index}`,
  );
}
```

Add the `looksLikeTextContent` helper function near the top of the file (after `isBinaryMediaMime`):

```typescript
/**
 * Heuristic: sample first 4096 bytes, count non-printable characters.
 * If ≤ 2% are non-printable, treat as text. This catches text files
 * misclassified by MIME (e.g., .log → application/octet-stream).
 * Office files (docx/xlsx) have >50% non-printable and won't match.
 * Ported from extensions/wecom/src/agent/handler.ts:80-92.
 */
function looksLikeTextContent(buffer: Buffer, sampleSize = 4096): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(sampleSize, buffer.length));
  let badChars = 0;
  for (const byte of sample) {
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) badChars++;
    if (byte === 0x7f) badChars++;
  }
  return badChars / sample.length <= 0.02;
}
```

- [ ] **Step 3: Add error notification in catch blocks**

In `extractFileBlocks()`, find the two catch blocks that silently skip:

**Catch 1** (~line 371-376, buffer fetch error):

```typescript
// Before:
} catch (err) {
  if (shouldLogVerbose()) {
    logVerbose(`media: file attachment skipped (buffer): ${String(err)}`);
  }
  continue;
}

// After:
} catch (err) {
  const label = attachment.path ?? attachment.url ?? `attachment-${attachment.index}`;
  const errMsg = `[⚠️ 媒体处理: ${label} — ${String(err)}]`;
  blocks.push(errMsg);
  logVerbose(`media: file attachment error (buffer): ${String(err)}`);
  continue;
}
```

**Catch 2** (~line 440+, file extraction error — find the `extractFileContentFromSource` catch):
Apply same pattern: push error message to `blocks` array instead of silently continuing.

- [ ] **Step 4: Run tests**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm test src/media-understanding/ src/media/mime
```

- [ ] **Step 5: Commit**

```bash
git add src/media-understanding/apply.ts src/media/mime.ts
git commit -m "[enhanced] feat(core): text heuristic for binary-classified files + media error notification"
```

---

### Task 2: chat.send — save attachments to disk + fill MediaPath + remove images bypass

**Context:** `src/gateway/server-methods/chat.ts` currently has `void parsedFiles` (line 791) discarding file attachments, and passes `parsedImages` directly to `replyOptions.images` (line 974) bypassing the unified MediaPath pipeline. Fix both: save all attachments to disk via `saveMediaBuffer()`, fill `MsgContext.MediaPath/MediaPaths/MediaTypes`, and remove the images bypass so everything flows through `getReplyFromConfig → applyMediaUnderstanding`.

**Files:**

- Modify: `src/gateway/server-methods/chat.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Import saveMediaBuffer**

Add import at top of file:

```typescript
import { saveMediaBuffer } from "../../media/store.js";
```

- [ ] **Step 2: Replace `void parsedFiles` with disk save + MediaPath fill**

At line 790-791 (`void parsedFiles`), replace with:

```typescript
// Save all parsed attachments to disk and build MediaPath arrays
const mediaPaths: string[] = [];
const mediaTypes: string[] = [];

for (const img of parsedImages) {
  const saved = await saveMediaBuffer(Buffer.from(img.data, "base64"), img.mimeType, "inbound");
  mediaPaths.push(saved.path);
  mediaTypes.push(saved.contentType);
}
for (const file of parsedFiles) {
  const saved = await saveMediaBuffer(
    Buffer.from(file.data, "base64"),
    file.mimeType,
    "inbound",
    undefined,
    file.fileName,
  );
  mediaPaths.push(saved.path);
  mediaTypes.push(saved.contentType);
}
```

- [ ] **Step 3: Fill MsgContext MediaPath fields**

In the `ctxPayload` construction block (~line 917-937), add after the existing fields:

```typescript
// Media from attachments (channel-equivalent MediaPath filling)
MediaPath: mediaPaths.length > 0 ? mediaPaths[0] : undefined,
MediaUrl: mediaPaths.length > 0 ? mediaPaths[0] : undefined,
MediaType: mediaTypes.length > 0 ? mediaTypes[0] : undefined,
MediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
MediaUrls: mediaPaths.length > 0 ? mediaPaths : undefined,
MediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
```

- [ ] **Step 4: Remove replyOptions.images bypass**

At line 974, remove the images direct pass:

```typescript
// Before:
images: parsedImages.length > 0 ? parsedImages : undefined,

// After: (remove entirely — images flow through MediaPath → applyMediaUnderstanding → detectAndLoadPromptImages)
// images: undefined, // Removed: unified MediaPath pipeline handles this
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm test src/gateway/server-methods/chat
```

- [ ] **Step 6: Commit**

```bash
git add src/gateway/server-methods/chat.ts
git commit -m "[enhanced] feat(gateway): chat.send saves attachments to disk + fills MediaPath, removes images bypass"
```

---

### Task 3: Dashboard Gateway adapter — tool-events cap + operator.approvals scope

**Context:** Dashboard needs to declare `tool-events` capability (to receive tool execution events) and `operator.approvals` scope (to receive and respond to approval requests). These are connection-level configuration changes in the Dashboard's Gateway adapter, not Gateway code changes.

**Files:**

- Modify: `dashboard/server/gateway-adapter.ts` (or equivalent connection configuration file)

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Find the Gateway connection configuration**

Search for where Dashboard connects to the Gateway WebSocket. Look for `connect(`, `GatewayAdapter`, or WebSocket connection options.

```bash
cd /Users/wangym/workspace/agents/openclaw && rg -n "connect\(|caps:|scopes:|GatewayAdapter" dashboard/server/ --type ts
```

- [ ] **Step 2: Add capabilities and scopes**

In the connection configuration, add:

```typescript
caps: ["tool-events"],
scopes: ["operator.read", "operator.write", "operator.approvals"],
```

If `caps` and `scopes` are not currently passed, add them to the connection options. If they're set elsewhere, extend them.

- [ ] **Step 3: Verify connection**

Start the dev server and check that the Gateway accepts the connection with the new capabilities:

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/server/
git commit -m "[enhanced] feat(deck): declare tool-events cap + operator.approvals scope"
```

---

### Task 4: ChatEvent schema media fields + emit paths

**Context:** `ChatEventSchema` has `additionalProperties: false`, so new fields must be explicitly added. Two emit paths (`emitChatFinal` in server-chat.ts and chat.send internal final in chat.ts) need to fill media fields when agent response includes media.

**Files:**

- Modify: `src/gateway/protocol/schema/logs-chat.ts`
- Modify: `src/gateway/server-chat.ts`
- Modify: `src/gateway/server-methods/chat.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add optional media fields to ChatEventSchema**

In `src/gateway/protocol/schema/logs-chat.ts`, add to `ChatEventSchema`:

```typescript
mediaUrl: Type.Optional(Type.String()),
mediaUrls: Type.Optional(Type.Array(Type.String())),
mediaType: Type.Optional(Type.String()),
```

- [ ] **Step 2: Update emitChatFinal in server-chat.ts**

In `emitChatFinal()` (~line 342-425), accept optional media parameters and include in payload:

```typescript
// Add to function parameters:
mediaUrls?: string[],

// Add to payload construction:
...(mediaUrls && mediaUrls.length > 0 ? {
  mediaUrl: mediaUrls[0],
  mediaUrls,
  mediaType: undefined, // filled by caller if known
} : {}),
```

- [ ] **Step 3: Update chat.send internal final in chat.ts**

In `src/gateway/server-methods/chat.ts`, find the chat.send final emit (~line 550-569) and pass collected media URLs.

- [ ] **Step 4: Run tests**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm test src/gateway/
```

- [ ] **Step 5: Commit**

```bash
git add src/gateway/protocol/schema/logs-chat.ts src/gateway/server-chat.ts src/gateway/server-methods/chat.ts
git commit -m "[enhanced] feat(gateway): ChatEvent media fields + dual emit path"
```

---

### Task 5: A2UI Phase 1 — command result events

**Context:** Canvas tool sends commands via `node.invoke`. The result handler is in `nodes.handlers.invoke-result.ts` (NOT `server-node-events.ts`). Add event broadcasting from the invoke result when the result carries an `events` array.

**Files:**

- Modify: `src/gateway/server-methods/nodes.handlers.invoke-result.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add event broadcast logic**

In `handleNodeInvokeResult` (~line 25-71), after processing the result, add:

```typescript
// Broadcast A2UI events if present in the result
if (result.events && Array.isArray(result.events)) {
  for (const event of result.events) {
    context.broadcast("a2ui", event);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/gateway/server-methods/nodes.handlers.invoke-result.ts
git commit -m "[enhanced] feat(gateway): broadcast A2UI events from node.invoke result"
```

---

### Task 6: Vision model fallback warning

**Context:** `src/agents/pi-embedded-runner/run/images.ts` `detectAndLoadPromptImages()` silently drops images when `modelSupportsImages()` returns false. Add a warning message so users know their images were ignored and can switch models.

**Files:**

- Modify: `src/agents/pi-embedded-runner/run/images.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add warning return field**

Find `detectAndLoadPromptImages()` and its return type. Add `warning?: string` to the return type.

- [ ] **Step 2: Return warning when images are dropped**

Early in `detectAndLoadPromptImages()`, where `modelSupportsImages()` is checked:

```typescript
if (!modelSupportsImages(params.model)) {
  const hasImages = (params.existingImages?.length ?? 0) > 0;
  return {
    images: [],
    detectedRefs: [],
    loadedCount: 0,
    skippedCount: params.existingImages?.length ?? 0,
    warning: hasImages
      ? "当前模型不支持图片分析，图片已忽略。可切换到支持 vision 的模型（如 claude-sonnet-4）。"
      : undefined,
  };
}
```

- [ ] **Step 3: Surface warning to user**

In the caller (`attempt.ts` ~line 1516), check for warning and inject into prompt or log:

```typescript
if (imageResult.warning) {
  // Prepend warning to prompt so agent can relay it to user
  effectivePrompt = `[系统提示: ${imageResult.warning}]\n\n${effectivePrompt}`;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm test src/agents/pi-embedded-runner/
```

- [ ] **Step 5: Commit**

```bash
git add src/agents/pi-embedded-runner/run/images.ts src/agents/pi-embedded-runner/run/attempt.ts
git commit -m "[enhanced] feat(agent): warn user when vision model not available for images"
```

---

### Task 7: WeCom slimming — remove upstreamed code

**Context:** After T1 pushes text preview, error notification, and MIME normalization to core, WeCom's private implementations become dead code. Remove them and verify WeCom still works via core.

**Files:**

- Modify: `extensions/wecom/src/agent/handler.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Remove text heuristic functions (lines 80-123)**

Delete `looksLikeTextFile()`, `analyzeTextHeuristic()`, and `buildTextFilePreview()`.

- [ ] **Step 2: Remove MIME extMap (lines 493-509)**

Delete the `extMap` constant. If it's used for filename extension resolution, replace with core `src/media/mime.ts` functions.

- [ ] **Step 3: Simplify media error catch block (lines 570-591)**

The core pipeline now injects error messages into `ctx.Body` automatically. Remove WeCom's custom error message construction. Keep the `auditSink` call if it provides additional WeCom-specific audit info.

- [ ] **Step 4: Verify build**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add extensions/wecom/src/agent/handler.ts
git commit -m "[enhanced] refactor(wecom): remove upstreamed text preview, MIME map, and error notification"
```

---

### Task 8: Dashboard SSE — listen to agent/approval/a2ui events

**Context:** Dashboard's `useChatSSE.ts` currently only listens to `chat` events. With T3 (tool-events cap) and T4 (approvals scope), the Dashboard WebSocket now receives `agent`, `exec.approval.requested/resolved`, and `a2ui` events. Wire them to the chat store and UI.

**Files:**

- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add i18n keys**

Add to `"chat"` namespace in both files:

**zh.json:**

```json
"approvalTitle": "工具执行审批",
"approvalAllow": "允许",
"approvalDeny": "拒绝",
"approvalAllowAlways": "始终允许",
"approvalExpired": "审批已过期"
```

**en.json:**

```json
"approvalTitle": "Tool Execution Approval",
"approvalAllow": "Allow",
"approvalDeny": "Deny",
"approvalAllowAlways": "Always Allow",
"approvalExpired": "Approval Expired"
```

- [ ] **Step 2: Add agent event listener to useChatSSE**

In `useChatSSE.ts`, add another `es.addEventListener` for `agent` events:

```typescript
es.addEventListener("agent", (e) => {
  const payload = JSON.parse(e.data);
  // Tool events contain tool name, input, result
  // Map to ContentBlock and append to the streaming message
  if (payload.stream === "tool" && payload.data) {
    const tool = payload.data;
    if (tool.name && streamingRunIdRef.current) {
      // Append tool_use block to current message
      const block: ContentBlock = {
        type: "tool_use",
        id: tool.id ?? `tool-${Date.now()}`,
        name: tool.name,
        input: tool.input ?? {},
      };
      appendBlock(streamingRunIdRef.current, block);
    }
  }
});
```

Note: `appendBlock` needs to be added to the chat store if not already present.

- [ ] **Step 3: Add approval event listener**

```typescript
es.addEventListener("exec.approval.requested", (e) => {
  const payload = JSON.parse(e.data);
  // Store pending approval in chat store or a new approval store
  setActiveApproval(payload);
});

es.addEventListener("exec.approval.resolved", (e) => {
  const payload = JSON.parse(e.data);
  setActiveApproval(null);
});
```

- [ ] **Step 4: Add a2ui event listener**

```typescript
es.addEventListener("a2ui", (e) => {
  const payload = JSON.parse(e.data);
  // Update artifact panel state
  // (integrate with existing ArtifactContext)
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/chat/useChatSSE.ts dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): listen to agent/approval/a2ui events in SSE"
```

---

### Task 9: Dashboard — ApprovalDialog component

**Context:** When the agent requests user approval to execute a tool (e.g., bash command), the Dashboard needs to show a dialog with the tool name, command, and allow/deny buttons.

**Files:**

- Create: `dashboard/src/components/panels/chat/ApprovalDialog.tsx`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Create ApprovalDialog.tsx**

```tsx
"use client";

import { Shield, Check, X, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface ApprovalDialogProps {
  approval: {
    id: string;
    toolName: string;
    command?: string;
    description?: string;
  };
  onResolve: (id: string, decision: "allow-once" | "allow-always" | "deny") => void;
}

export function ApprovalDialog({ approval, onResolve }: ApprovalDialogProps) {
  const t = useTranslations("chat");

  return (
    <div className="mx-4 my-2 p-4 rounded-xl bg-[var(--bg-tertiary)] ring-1 ring-[var(--warning)]/30 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        <Shield size={16} className="text-[var(--warning)]" />
        {t("approvalTitle")}
      </div>
      <div className="text-xs text-[var(--text-secondary)]">
        <code className="font-mono text-[var(--accent)]">{approval.toolName}</code>
        {approval.command && (
          <pre className="mt-1.5 p-2 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-auto max-h-[120px]">
            {approval.command}
          </pre>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => onResolve(approval.id, "allow-once")}
        >
          <Check size={12} /> {t("approvalAllow")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => onResolve(approval.id, "allow-always")}
        >
          <ShieldCheck size={12} /> {t("approvalAllowAlways")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1"
          onClick={() => onResolve(approval.id, "deny")}
        >
          <X size={12} /> {t("approvalDeny")}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into ChatPanel**

In `ChatPanel.tsx`, add approval state and the resolve handler:

```typescript
const [activeApproval, setActiveApproval] = useState<ApprovalInfo | null>(null);

const handleResolveApproval = async (id: string, decision: string) => {
  await fetch("/api/exec/approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, decision }),
  });
  setActiveApproval(null);
};

// In the JSX, above MessageInput:
{activeApproval && (
  <ApprovalDialog approval={activeApproval} onResolve={handleResolveApproval} />
)}
```

- [ ] **Step 3: Create approval API route**

Create `dashboard/src/app/api/exec/approval/route.ts`:

```typescript
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { id: string; decision: string };
  return gatewayRequest("exec.approval.resolve", {
    id: body.id,
    decision: body.decision,
  });
});
```

Add `exec.approval.resolve` to `dashboard/server/gateway-allowlist.ts`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/chat/ApprovalDialog.tsx dashboard/src/components/panels/chat/ChatPanel.tsx dashboard/src/app/api/exec/approval/ dashboard/server/gateway-allowlist.ts
git commit -m "[enhanced] feat(deck): approval dialog for tool execution requests"
```

---

## Verification

After all tasks, verify:

1. `cd /Users/wangym/workspace/agents/openclaw && pnpm test` — core tests pass
2. `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit` — zero errors
3. Browser test:
   - Upload image via chat → image saved to `~/.openclaw/media/inbound/` → agent receives via MediaPath
   - Upload PDF → text extracted by `applyMediaUnderstanding` → agent sees file content
   - Upload `.log` file (binary MIME) → text heuristic catches it → agent sees content
   - Send message that triggers tool → ToolUseCard appears in chat
   - Agent requests approval → ApprovalDialog appears → allow/deny works
   - If model lacks vision → warning message appears in chat
   - WeCom channel still works after code removal (receives files, processes media)
