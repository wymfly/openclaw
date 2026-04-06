# WeCom Wizard Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WeCom fully configurable from the Deck dashboard — wire the existing WeComWizard into the UI, add dual-mode (Bot+Agent) support, integrate DM policy selection, and provide all missing i18n keys.

**Architecture:** Extend the existing `WeComWizard.tsx` (ConfigWizard framework) with a 5th transport option "bot-ws + agent" that shows combined credentials. Add DM policy as a new wizard step. Wire the wizard into `ChannelSettingsTab` for WeCom channels. All text via `useTranslations()`.

**Tech Stack:** React, next-intl, shadcn/ui, ConfigWizard framework, DmPolicySelector

---

## Scope

| Item                          | In Scope | Notes                                         |
| ----------------------------- | -------- | --------------------------------------------- |
| i18n keys (en.json + zh.json) | ✅       | ~50 keys, currently 100% missing              |
| Wire wizard into UI           | ✅       | WeComWizard exported but never imported       |
| Dual-mode Bot+Agent           | ✅       | 5th transport card                            |
| DM policy step                | ✅       | Reuse existing DmPolicySelector               |
| Multi-account UI              | ❌       | Deferred — single account covers 90% of users |
| Enhanced features UI          | ❌       | Deferred — schema form fallback handles these |

## File Map

| File                                                              | Action | Responsibility                                                    |
| ----------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `dashboard/src/i18n/en.json`                                      | Modify | Add `wizard.wecom.*` + `wizard.common.*` keys                     |
| `dashboard/src/i18n/zh.json`                                      | Modify | Chinese translations for all above keys                           |
| `dashboard/src/components/panels/channels/WeComWizard.tsx`        | Modify | Add dual-mode transport, DM policy step, rewrite buildConfigPatch |
| `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx` | Modify | Wire WeComWizard trigger for wecom channel                        |

---

### Task 1: Add i18n Keys for WeCom Wizard

**Files:**

- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

- [ ] **Step 1: Add wizard namespace to en.json**

The `"wizard"` key already exists at the top level (used by the models Add Provider wizard). Add the WeCom and common wizard keys. Find the existing `"wizard": {` block (around line 488 inside the `"models"` section) — this is scoped to models. We need a **top-level** `"wizard"` namespace.

Check if a top-level `"wizard"` already exists. If it's inside `"models"`, we need to add a separate top-level one. The `ConfigWizard.tsx` uses `useTranslations("wizard")` — so the keys must be at root `"wizard"`.

Add to `dashboard/src/i18n/en.json` at the root level (after any existing top-level sections):

```json
"wizard": {
  "stepProgress": "Step {current} / {total}",
  "back": "Back",
  "next": "Next",
  "complete": "Complete",
  "validating": "Validating...",
  "testConnection": "Test Connection",
  "testing": "Testing...",
  "wecom": {
    "title": "Configure WeCom",
    "step1Title": "Select Connection Mode",
    "step2Title": "Enter Credentials",
    "step3Title": "DM Policy",
    "step4Title": "Callback URL",
    "step5Title": "Test Connection",
    "transportBotWs": "Bot WebSocket",
    "transportBotWsDesc": "Real-time push via WebSocket. Simplest setup — no public domain needed.",
    "transportBotWebhook": "Bot Webhook",
    "transportBotWebhookDesc": "Event-driven via HTTP callback. Requires a public domain.",
    "transportAgentCallback": "Agent Callback",
    "transportAgentCallbackDesc": "Full Agent API: proactive messaging, media upload, broadcasts.",
    "transportDualMode": "Bot WS + Agent",
    "transportDualModeDesc": "Recommended for production. Bot handles real-time chat, Agent handles media & broadcasts.",
    "transportKfApi": "Customer Service API",
    "transportKfApiDesc": "WeCom Customer Service platform integration.",
    "pluginNotInstalled": "WeCom plugin is not installed. Install it first via CLI: openclaw plugins install wecom",
    "botId": "Bot ID",
    "botIdHint": "Machine robot ID from WeCom admin console",
    "botSecret": "Bot Secret",
    "botSecretHint": "Robot secret key",
    "token": "Callback Token",
    "tokenHint": "Verification token for callback URL",
    "encodingAESKey": "EncodingAESKey",
    "encodingAESKeyHint": "43-character encryption key for callback messages",
    "corpId": "Corp ID",
    "corpIdHint": "Enterprise ID from WeCom admin console",
    "agentId": "Agent ID",
    "agentIdHint": "Application ID (numeric)",
    "agentSecret": "Agent Secret",
    "agentSecretHint": "Application secret key (corpSecret)",
    "callbackUrlDesc": "Copy this URL and paste it into the WeCom admin console as the callback URL:",
    "callbackUrlNote": "Replace {GATEWAY_URL} with your actual gateway address (e.g. https://your-domain.com)",
    "noCallbackNeeded": "Bot WebSocket mode does not require a callback URL.",
    "dualModeCallbackNote": "Agent callback URL (Bot WS does not need a callback):",
    "testDesc": "Save the configuration first, then test the connection to verify credentials.",
    "probeConfigNote": "Make sure to click \"Complete\" to save before testing. The probe checks the live gateway status.",
    "probeSuccess": "Connected successfully!",
    "probeNoChannel": "WeCom channel not found in gateway. Is the plugin installed?",
    "probeFailed": "Connection test failed. Check credentials and try again.",
    "dmPolicyLabel": "Choose who can send direct messages to this bot:",
    "sectionBot": "Bot Credentials",
    "sectionAgent": "Agent Credentials"
  }
}
```

- [ ] **Step 2: Add wizard namespace to zh.json**

Add the same structure in Chinese:

```json
"wizard": {
  "stepProgress": "第 {current} 步 / 共 {total} 步",
  "back": "上一步",
  "next": "下一步",
  "complete": "完成",
  "validating": "验证中...",
  "testConnection": "测试连接",
  "testing": "测试中...",
  "wecom": {
    "title": "配置企业微信",
    "step1Title": "选择连接方式",
    "step2Title": "填写凭证",
    "step3Title": "私聊策略",
    "step4Title": "回调 URL",
    "step5Title": "测试连接",
    "transportBotWs": "Bot WebSocket",
    "transportBotWsDesc": "WebSocket 实时推送，配置最简单，无需公网域名。",
    "transportBotWebhook": "Bot Webhook",
    "transportBotWebhookDesc": "HTTP 回调驱动，需要公网域名。",
    "transportAgentCallback": "Agent 应用回调",
    "transportAgentCallbackDesc": "完整 Agent API：主动推送、媒体上传、群发广播。",
    "transportDualMode": "Bot WS + Agent",
    "transportDualModeDesc": "生产推荐。Bot 负责实时对话，Agent 负责媒体和主动推送。",
    "transportKfApi": "客服 API",
    "transportKfApiDesc": "企业微信客服平台集成。",
    "pluginNotInstalled": "WeCom 插件未安装。请先通过 CLI 安装：openclaw plugins install wecom",
    "botId": "Bot ID",
    "botIdHint": "企微管理后台的机器人 ID",
    "botSecret": "Bot Secret",
    "botSecretHint": "机器人密钥",
    "token": "回调 Token",
    "tokenHint": "回调 URL 验证令牌",
    "encodingAESKey": "EncodingAESKey",
    "encodingAESKeyHint": "43 位回调消息加密密钥",
    "corpId": "企业 ID",
    "corpIdHint": "企微管理后台的企业 ID",
    "agentId": "应用 ID",
    "agentIdHint": "应用 ID（数字）",
    "agentSecret": "应用密钥",
    "agentSecretHint": "应用密钥（corpSecret）",
    "callbackUrlDesc": "复制此 URL 并粘贴到企微管理后台作为回调地址：",
    "callbackUrlNote": "将 {GATEWAY_URL} 替换为实际的网关地址（如 https://your-domain.com）",
    "noCallbackNeeded": "Bot WebSocket 模式不需要回调 URL。",
    "dualModeCallbackNote": "Agent 回调 URL（Bot WS 不需要回调）：",
    "testDesc": "先保存配置，然后测试连接以验证凭证。",
    "probeConfigNote": "请先点击「完成」保存配置，探针检查的是实时网关状态。",
    "probeSuccess": "连接成功！",
    "probeNoChannel": "网关中未找到 WeCom 渠道。插件是否已安装？",
    "probeFailed": "连接测试失败，请检查凭证后重试。",
    "dmPolicyLabel": "选择谁可以向此机器人发送私信：",
    "sectionBot": "Bot 凭证",
    "sectionAgent": "Agent 凭证"
  }
}
```

- [ ] **Step 3: Verify i18n loads correctly**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No i18n-related errors (JSON parse errors would surface here)

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add WeCom wizard i18n keys (en + zh)" dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

### Task 2: Wire WeComWizard into ChannelSettingsTab

**Files:**

- Modify: `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx`

**Problem:** `WeComWizard` is exported but never imported — users can't access it from the Deck UI.

**Approach:** Add a "Configure WeCom" button in `ChannelSettingsTab` when `channelId === "wecom"`. The button opens the WeComWizard dialog.

- [ ] **Step 1: Add WeComWizard trigger to ChannelSettingsTab**

Read `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx` first. Then modify:

```typescript
// Add imports at top:
import { useState } from "react"; // already imported
import { Settings2 } from "lucide-react";
import { WeComWizard } from "./WeComWizard";

// Inside ChannelSettingsTab, before the schema check:
export function ChannelSettingsTab({ channelId }: ChannelSettingsTabProps) {
  const t = useTranslations("channels.settings");
  const { channelSchemas } = useChannelsStore();
  const [wizardOpen, setWizardOpen] = useState(false);
  const schemaInfo = channelSchemas.get(channelId);

  // WeCom: show wizard button + legacy settings
  // WeCom's schema is intentionally permissive (empty properties), so the schema check
  // falls through to LegacyChannelSettings. We add the wizard trigger here.
  if (channelId === "wecom") {
    return (
      <>
        <div className="flex flex-col h-full">
          {/* Wizard trigger */}
          <div className="px-4 pt-3 pb-2">
            <button
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border transition-colors hover:border-[var(--border-hover)]"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--foreground)",
              }}
            >
              <Settings2 size={14} style={{ color: "var(--primary)" }} />
              <span>{t("configureWizard")}</span>
            </button>
          </div>
          {/* Legacy settings (DM policy + retry) below */}
          <div className="flex-1 overflow-hidden">
            <LegacyChannelSettings channelId={channelId} />
          </div>
        </div>
        <WeComWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </>
    );
  }

  // ... existing schema check and fallback logic unchanged
```

- [ ] **Step 2: Add i18n key for the button**

In `dashboard/src/i18n/en.json`, inside `"channels" → "settings"`:

```json
"configureWizard": "Configure Connection (Wizard)"
```

In `dashboard/src/i18n/zh.json`:

```json
"configureWizard": "配置连接（向导）"
```

- [ ] **Step 3: Verify**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): wire WeComWizard into ChannelSettingsTab" dashboard/src/components/panels/channels/ChannelSettingsTab.tsx dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

### Task 3: Add Dual-Mode Transport + Credentials

**Files:**

- Modify: `dashboard/src/components/panels/channels/WeComWizard.tsx`

**Problem:** Current wizard only supports single mode (Bot OR Agent). Production environments need both simultaneously.

- [ ] **Step 1: Add "dual" transport type and form fields**

Read `dashboard/src/components/panels/channels/WeComWizard.tsx`. Then modify:

```typescript
// Line 13: Add "dual" to the transport union
type WeComTransport = "bot-ws" | "bot-webhook" | "agent-callback" | "dual" | "kf-api";
```

- [ ] **Step 2: Add dual-mode transport card**

In the `transportCards` array (around line 140), add after "agent-callback" and before "kf-api":

```typescript
{
  id: "dual",
  title: t("wecom.transportDualMode"),
  desc: t("wecom.transportDualModeDesc"),
},
```

- [ ] **Step 3: Add dual-mode credentials form**

In step2Content (around line 198), add a new conditional block for `form.transport === "dual"`:

```typescript
{form.transport === "dual" && (
  <>
    {/* Bot WS section */}
    <p className="text-xs font-medium text-[var(--foreground)]">
      {t("wecom.sectionBot")}
    </p>
    <div>
      <Label className="text-xs">{t("wecom.botId")}</Label>
      <Input
        value={form.botId}
        onChange={(e) => updateField("botId", e.target.value)}
        placeholder={t("wecom.botIdHint")}
        className="mt-1"
      />
    </div>
    <div>
      <Label className="text-xs">{t("wecom.botSecret")}</Label>
      <Input
        type="password"
        value={form.botSecret}
        onChange={(e) => updateField("botSecret", e.target.value)}
        placeholder={t("wecom.botSecretHint")}
        className="mt-1"
      />
    </div>
    {/* Agent section */}
    <div className="border-t pt-3 mt-1" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-medium text-[var(--foreground)]">
        {t("wecom.sectionAgent")}
      </p>
    </div>
    <div>
      <Label className="text-xs">{t("wecom.corpId")}</Label>
      <Input
        value={form.corpId}
        onChange={(e) => updateField("corpId", e.target.value)}
        placeholder={t("wecom.corpIdHint")}
        className="mt-1"
      />
    </div>
    <div>
      <Label className="text-xs">{t("wecom.agentId")}</Label>
      <Input
        value={form.agentId}
        onChange={(e) => updateField("agentId", e.target.value)}
        placeholder={t("wecom.agentIdHint")}
        className="mt-1"
      />
    </div>
    <div>
      <Label className="text-xs">{t("wecom.agentSecret")}</Label>
      <Input
        type="password"
        value={form.agentSecret}
        onChange={(e) => updateField("agentSecret", e.target.value)}
        placeholder={t("wecom.agentSecretHint")}
        className="mt-1"
      />
    </div>
    <div>
      <Label className="text-xs">{t("wecom.token")}</Label>
      <Input
        value={form.agentToken}
        onChange={(e) => updateField("agentToken", e.target.value)}
        placeholder={t("wecom.tokenHint")}
        className="mt-1"
      />
    </div>
    <div>
      <Label className="text-xs">{t("wecom.encodingAESKey")}</Label>
      <Input
        value={form.agentEncodingAESKey}
        onChange={(e) => updateField("agentEncodingAESKey", e.target.value)}
        placeholder={t("wecom.encodingAESKeyHint")}
        className="mt-1"
      />
    </div>
  </>
)}
```

- [ ] **Step 4: Add dual-mode validation**

In the step2 validate function (around line 362), add a case:

```typescript
case "dual":
  return (
    form.botId.trim() !== "" &&
    form.botSecret.trim() !== "" &&
    form.corpId.trim() !== "" &&
    form.agentSecret.trim() !== "" &&
    form.agentToken.trim() !== "" &&
    form.agentEncodingAESKey.trim() !== ""
  );
```

- [ ] **Step 5: Add dual-mode buildConfigPatch**

In `buildConfigPatch` (around line 98), add a case:

```typescript
case "dual":
  return {
    bot: {
      primaryTransport: "ws",
      ws: { botId: form.botId, secret: form.botSecret },
    },
    agent: {
      corpId: form.corpId,
      agentId: form.agentId,
      agentSecret: form.agentSecret,
      token: form.agentToken,
      encodingAESKey: form.agentEncodingAESKey,
    },
  };
```

- [ ] **Step 6: Update callbackUrl for dual mode**

In the `callbackUrl` useMemo (around line 130), add:

```typescript
if (form.transport === "dual") {
  return `{GATEWAY_URL}/wecom/agent/callback`;
}
```

- [ ] **Step 7: Update callback URL step content for dual mode**

In step3Content (step 4 after reordering, around line 299), update to show dual-mode note:

```typescript
// Add at the top of step content, before the callbackUrl check:
{form.transport === "dual" && callbackUrl && (
  <>
    <p className="text-xs text-[var(--muted-foreground)]">
      {t("wecom.dualModeCallbackNote")}
    </p>
    {/* ... existing URL display ... */}
  </>
)}
```

- [ ] **Step 8: Verify**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add dual-mode Bot+Agent transport to WeComWizard" dashboard/src/components/panels/channels/WeComWizard.tsx
```

---

### Task 4: Add DM Policy Step to Wizard

**Files:**

- Modify: `dashboard/src/components/panels/channels/WeComWizard.tsx`

**Problem:** DM policy is only configurable via LegacyChannelSettings after initial setup. Users should set it during the wizard.

- [ ] **Step 1: Add DM policy state to form**

Add to `WeComFormData` interface:

```typescript
dmPolicy: string;
```

Add to `INITIAL_FORM`:

```typescript
dmPolicy: "pairing",
```

- [ ] **Step 2: Import and render DmPolicySelector**

Add import:

```typescript
import { DmPolicySelector } from "./DmPolicySelector";
```

Add new step content (insert between credentials and callback URL):

```typescript
// DM policy step
const dmPolicyContent = (
  <div className="space-y-3">
    <p className="text-xs text-[var(--muted-foreground)]">
      {t("wecom.dmPolicyLabel")}
    </p>
    <DmPolicySelector
      value={form.dmPolicy}
      onChange={(policy) => updateField("dmPolicy", policy)}
    />
  </div>
);
```

- [ ] **Step 3: Reorder wizard steps to 5 steps**

Update the `steps` array to insert DM policy as step 3:

```typescript
const steps: WizardStep[] = useMemo(
  () => [
    {
      title: t("wecom.step1Title"),
      content: step1Content,
      validate: () => form.transport !== null,
    },
    {
      title: t("wecom.step2Title"),
      content: step2Content,
      validate: () => {
        /* existing validation */
      },
    },
    {
      title: t("wecom.step3Title"),
      content: dmPolicyContent,
      // No validation needed — always has a default
    },
    {
      title: t("wecom.step4Title"),
      content: callbackUrlContent,
    },
    {
      title: t("wecom.step5Title"),
      content: probeContent,
    },
  ],
  [t, form, probeResult, probeMessage, copied, pluginInstalled],
);
```

- [ ] **Step 4: Include DM policy in buildConfigPatch**

Update all cases in `buildConfigPatch` to include DM policy. For the "bot-ws" case:

```typescript
case "bot-ws":
  return {
    bot: {
      primaryTransport: "ws",
      ws: { botId: form.botId, secret: form.botSecret },
      dm: { policy: form.dmPolicy },
    },
  };
```

Apply the same `dm: { policy: form.dmPolicy }` pattern to all cases:

- "bot-webhook": inside `bot`
- "agent-callback" / "kf-api": inside `agent`
- "dual": inside both `bot` and `agent`

- [ ] **Step 5: Verify**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add DM policy step to WeComWizard" dashboard/src/components/panels/channels/WeComWizard.tsx
```

---

### Task 5: Visual Verification

- [ ] **Step 1: Start dev environment**

```bash
scripts/dev/deck-dev.sh
```

- [ ] **Step 2: Navigate to Channels panel**

Open `http://localhost:3000` → Channels → WeCom → Settings tab

- [ ] **Step 3: Verify wizard trigger**

Click "Configure Connection (Wizard)" button. Wizard dialog should open.

- [ ] **Step 4: Walk through all 5 transport modes**

For each mode (Bot WS, Bot Webhook, Agent Callback, Bot WS + Agent, Customer Service API):

1. Select the transport card — verify highlight and description
2. Click Next — verify credentials form shows correct fields
3. Fill in test values — verify validation (Next disabled until required fields filled)
4. DM policy step — verify 4 options with "pairing" recommended badge
5. Callback URL step — verify URL display (or "not needed" message for Bot WS)
6. Test Connection step — verify probe button works

- [ ] **Step 5: Verify dual-mode specifically**

Select "Bot WS + Agent":

1. Credentials step should show Bot section (2 fields) + Agent section (5 fields) with visual separator
2. Callback URL step should show Agent callback URL with dual-mode note
3. Config patch should write both `bot` and `agent` sections

- [ ] **Step 6: Verify i18n**

Switch language to English and Chinese. All wizard text should be translated. No raw key paths visible.

- [ ] **Step 7: Commit any fixes from visual testing**

```bash
scripts/committer "[enhanced] fix(deck): WeComWizard visual polish" <changed-files>
```
