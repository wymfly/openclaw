# Sessions Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sessions 面板视觉对齐 `frontend-handoff/modules/sessions/prototype.html`（dark / 1440 / Overview tab active / 有 selected session 状态），≥ 90% 一致度；light theme 不回归；不动 canonical tokens / atoms / 其他 panel / 契约 / mutation。

**Architecture:** 在 `sessions-panel.css` 内做 scoped CSS 变量 override（spacing / radius / fs / line 跨主题；colors / shadow 走 `[data-theme="dark"]` guard，避免 light 白底白字）。在 `SessionsPanel.tsx` 做 6 项 prototype 对齐改动（删 Hero 多余 badge、stat-grid 6→4、删 Runtime metadata 重复 section、Transcript 区域瘦身、Inspector Overview 加 Tab summaries row、Inventory row 5→4、Compactions hint 文案修复）。新增 `test/e2e/sessions-visual-parity.spec.ts` 作为机器化 verdict 闭环。

**Tech Stack:** TypeScript / React 19 / Vite / Vitest + React Testing Library / Playwright / CSS variables。

**Spec reference:** `docs/superpowers/specs/2026-05-11-sessions-visual-parity-design.md`

---

## 文件结构

本计划触达的文件清单：

| 文件                                                                         | 操作   | 职责                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deck-go/frontend-new/src/components/panels/sessions/sessions-panel.css`     | Modify | 顶部新增 scoped token override；底部加 `.sessions-transcript-list` max-height                                                                      |
| `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx`      | Modify | Hero / stat-grid / Runtime metadata / Transcript / Inspector Overview / Inventory row / Compactions hint 改动                                      |
| `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx` | Modify | 同步上述结构改动相关断言                                                                                                                           |
| `deck-go/test/e2e/sessions-visual-parity.spec.ts`                            | Create | 新增 prototype-vs-mock 视觉 / DOM / token 断言；输出 `prototype.png` / `mock-current.png` / `sheet.png` / `verdict.json`；含 `@light` smoke 子用例 |
| `deck-go/frontend-handoff/modules/sessions/implementation-notes.md`          | Modify | 追加 `## Visual parity — 2026-05-11` 段落，列结构化 evidence                                                                                       |

**不动**：canonical `tokens/index.css`、design-system atoms、其他 panel CSS / TSX、i18n 文件、契约、API、后端、mutation 行为。

**TDD 策略**：JSX 结构改动用 Vitest 单元测试 TDD（快反馈，jsdom 不渲染 CSS）；CSS / 视觉 / token 应用走 Playwright `sessions-visual-parity.spec.ts` 集中验证。

---

## Task 1: Hero 删除 history / lineage badge

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx`（Hero `sessions-status-row` 区，当前约 805-823 行：`<Badge>{t("historyMessages"...)}</Badge>` 和 `selectedIsSubagent ? <Badge>{t("lineageStatus"...)}</Badge>`）
- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx`

- [ ] **Step 1: 在 SessionsPanel.test.tsx 加 failing 断言**

在 `SessionsPanel.test.tsx` 现有 describe 块尾部加（前提：测试文件已有 `renderPanel` / `screen` / `await waitFor` 等基础设施，参考其他用例）：

```tsx
it("removes history and lineage badges from selected hero", async () => {
  renderPanel();
  await waitFor(() => {
    expect(screen.getByTestId("sessions-panel")).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByText(/Main Session/i)).toBeInTheDocument();
  });
  const hero = document.querySelector(".sessions-hero");
  expect(hero).not.toBeNull();
  expect(hero!.querySelector(".sessions-status-row")?.textContent ?? "").not.toMatch(/history/i);
  expect(hero!.querySelector(".sessions-status-row")?.textContent ?? "").not.toMatch(/lineage/i);
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx -t "removes history and lineage badges"
```

Expected: FAIL（"history" 仍出现在 hero status-row）

- [ ] **Step 3: 修改 SessionsPanel.tsx 删 Hero history / lineage badge**

找到 Hero 内的 `sessions-status-row`（含 `<Badge>{t("historyMessages"...)`），把内容改为只保留 `runtime` 和 `contextPercent` 两个 Badge（外加 prototype 截图里的 status pill 由 `Badge variant={statusVariant(...)}` 实现，但当前代码 Hero 没有这一行——按 prototype `idle / runtime / context` 三个 pill，需要新增 status pill）：

把这段（约 805-823 行）：

```tsx
<div className="sessions-status-row">
  <Badge>{t("historyMessages", { count: history?.messages?.length ?? 0 })}</Badge>
  {selectedIsSubagent ? (
    <Badge variant={lineageState === "ready" ? "ok" : "neutral"}>
      {t("lineageStatus", { state: t(lineageState) })}
    </Badge>
  ) : null}
  <Badge>
    {t("runtimeValue", {
      value:
        selectedSession?.runtimeMs != null
          ? t("milliseconds", { value: selectedSession.runtimeMs })
          : t("na"),
    })}
  </Badge>
  {selectedContextPressure != null ? (
    <Badge>{t("contextPercent", { percent: selectedContextPressure })}</Badge>
  ) : null}
</div>
```

替换为（prototype 三个 pill：status / runtime / context %）：

```tsx
<div className="sessions-status-row">
  <Badge variant={statusVariant(selectedSession?.status)}>
    {selectedSession?.status || t("unknown")}
  </Badge>
  <Badge>
    {t("runtimeValue", {
      value:
        selectedSession?.runtimeMs != null
          ? t("milliseconds", { value: selectedSession.runtimeMs })
          : t("na"),
    })}
  </Badge>
  {selectedContextPressure != null ? (
    <Badge>{t("contextPercent", { percent: selectedContextPressure })}</Badge>
  ) : null}
</div>
```

- [ ] **Step 4: 跑测试通过**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx
```

Expected: 新加的"removes history and lineage badges"用例 PASS。检查其他用例无回归——若有其他用例断言 Hero 上的 history 文案，标记失败的用例并按 spec 2.6 节"Hero badges 断言：history 与 lineage 两个 badge 不再出现在 Hero status row"原则更新它们。

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: remove history/lineage badges from selected hero" deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx
```

---

## Task 2: Hero stat-grid 6 → 4 stats

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx`（Hero 下方独立 Runtime metadata section 不动；本 task 处理的是 Hero 内嵌的 stat-grid，prototype 把 stat-grid 直接放在 Hero card 内、stat-grid 含 4 项 Input / Output / Model / Policy。当前代码 Hero 内**没有** stat-grid——stats 都在独立的 Runtime metadata section 里。需要把"Hero 下 stat-grid"新增到 Hero card 内。注意 prototype.html:524-529 的形态。）
- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx`

- [ ] **Step 1: 加 failing 断言**

在 `SessionsPanel.test.tsx` 加：

```tsx
it("hero card renders a 4-stat grid (Input/Output/Model/Policy) and not 6", async () => {
  renderPanel();
  await waitFor(() => {
    expect(screen.getByText(/Main Session/i)).toBeInTheDocument();
  });
  const hero = document.querySelector(".sessions-hero");
  expect(hero).not.toBeNull();
  const heroStatGrid = hero!.querySelector(".sessions-stat-grid");
  expect(heroStatGrid).not.toBeNull();
  expect(heroStatGrid!.querySelectorAll(".sessions-stat").length).toBe(4);
  expect(heroStatGrid!.textContent ?? "").toMatch(/Input/i);
  expect(heroStatGrid!.textContent ?? "").toMatch(/Output/i);
  expect(heroStatGrid!.textContent ?? "").toMatch(/Model/i);
  expect(heroStatGrid!.textContent ?? "").toMatch(/Policy/i);
});
```

- [ ] **Step 2: 跑测试失败**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx -t "hero card renders a 4-stat grid"
```

Expected: FAIL（Hero 内没有 stat-grid）

- [ ] **Step 3: 修改 SessionsPanel.tsx，在 Hero card 内、`sessions-status-row` 之后新增 4-stat grid**

找到 Task 1 修改后的 Hero `sessions-status-row` 关闭 `</div>`，紧随其后（在 `</section>` 结束 Hero 前）插入：

```tsx
<div className="sessions-stat-grid">
  <StatTile
    label={t("inputTokens")}
    value={formatCompactNumber(positiveNumber(selectedSession?.inputTokens ?? undefined))}
  />
  <StatTile
    label={t("outputTokens")}
    value={formatCompactNumber(positiveNumber(selectedSession?.outputTokens ?? undefined))}
  />
  <StatTile label={t("modelLabel")} value={selectedSession?.model || t("na")} />
  <StatTile
    label={t("policyLabel")}
    value={`${selectedSession?.thinkingLevel || t("off")} | fast ${selectedSession?.fastMode ? t("on") : t("off")}`}
  />
</div>
```

如果 i18n key `modelLabel` / `policyLabel` 不存在，复用既有 key（按本 spec scope 不动 i18n 文件原则）：用 `t("modelOverride")` 替代 `modelLabel`（已存在，文案 "Model override"）、用 `t("fastMode")` 替代 `policyLabel`（已存在，文案 "Fast mode"）。也可以直接硬编码 fallback 文本（`"Model"` / `"Policy"`）——以代码可读优先，**首选**直接英文硬编码（这两个是 prototype 截图里的英文显示，符合 prototype 视觉对齐目标）：

```tsx
<div className="sessions-stat-grid">
  <StatTile
    label="Input"
    value={formatCompactNumber(positiveNumber(selectedSession?.inputTokens ?? undefined))}
  />
  <StatTile
    label="Output"
    value={formatCompactNumber(positiveNumber(selectedSession?.outputTokens ?? undefined))}
  />
  <StatTile label="Model" value={selectedSession?.model || t("na")} />
  <StatTile
    label="Policy"
    value={`${selectedSession?.thinkingLevel || t("off")} | fast ${selectedSession?.fastMode ? t("on") : t("off")}`}
  />
</div>
```

- [ ] **Step 4: 跑测试通过**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: add 4-stat grid to hero (Input/Output/Model/Policy)" deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx
```

---

## Task 3: 删除独立 Runtime metadata section

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx`（约 827-870 行的 `<section className="sessions-surface">` 含 `t("runtimeMetadata")` heading）
- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx`

- [ ] **Step 1: 加 failing 断言**

```tsx
it("does not render an independent Runtime metadata surface", async () => {
  renderPanel();
  await waitFor(() => {
    expect(screen.getByText(/Main Session/i)).toBeInTheDocument();
  });
  const panel = document.querySelector(".sessions-panel");
  const surfaces = panel!.querySelectorAll(".sessions-surface");
  const runtimeMetadataHeadings = Array.from(surfaces).filter((surface) =>
    surface.querySelector("h3")?.textContent?.toLowerCase().includes("runtime metadata"),
  );
  expect(runtimeMetadataHeadings.length).toBe(0);
});
```

如果当前 i18n `runtimeMetadata` 值不是 "Runtime metadata"，调整测试匹配（用 `t("runtimeMetadata")` 字面量比较或在测试里直接 import 该 key 值）。先用字面量 "Runtime metadata"，跑一次看实际文案，必要时改成准确字符串。

- [ ] **Step 2: 跑测试失败**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx -t "Runtime metadata surface"
```

Expected: FAIL

- [ ] **Step 3: 删除 Runtime metadata section**

找到 SessionsPanel.tsx 中以下整段（约 827-870 行）：

```tsx
{
  selectedSession ? (
    <section className="sessions-surface">
      <div className="sessions-section-heading">
        <h3>{t("runtimeMetadata")}</h3>
        <Badge variant={statusVariant(selectedSession.status)}>
          {selectedSession.status || t("unknown")}
        </Badge>
      </div>
      <div className="sessions-stat-grid">
        <StatTile
          label={t("inputTokens")}
          value={formatCompactNumber(positiveNumber(selectedSession.inputTokens))}
        />
        <StatTile
          label={t("outputTokens")}
          value={formatCompactNumber(positiveNumber(selectedSession.outputTokens))}
        />
        <StatTile label={t("totalTokens")} value={formatCompactNumber(selectedTotalTokens)} />
        <StatTile label={t("contextWindow")} value={formatCompactNumber(selectedContextTokens)} />
        <StatTile
          label={t("contextPressure")}
          value={selectedContextPressure != null ? `${selectedContextPressure}%` : t("na")}
        />
        <StatTile label={t("estimatedCost")} value={formatCost(selectedSession.estimatedCostUsd)} />
      </div>
      <p className="sessions-note">
        {t("thinkingFastMode", {
          fastMode: selectedSession.fastMode ? t("on") : t("off"),
          thinking: selectedSession.thinkingLevel || t("off"),
        })}
      </p>
    </section>
  ) : null;
}
```

整段删除。

- [ ] **Step 4: 跑测试通过**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx
```

Expected: PASS（包含新测试 + 旧测试无回归。若有旧测试断言 `t("runtimeMetadata")` 出现，按 spec 2.6 节"Runtime metadata 独立 section 相关断言：删除或标记为 absent"原则更新它们。）

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: drop duplicate Runtime metadata surface from selected workbench" deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx
```

---

## Task 4: Inspector Overview Tab summaries row

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx`（Inspector Overview tab，约 994-1027 行）
- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx`

- [ ] **Step 1: 加 failing 断言**

```tsx
it("inspector overview tab includes a Tab summaries row (history/lineage/usage/checkpoint)", async () => {
  renderPanel();
  await waitFor(() => {
    expect(screen.getByText(/Main Session/i)).toBeInTheDocument();
  });
  const overview = document.querySelector("#sessions-inspector-overview");
  expect(overview).not.toBeNull();
  const summaryRow = overview!.querySelector(".sessions-status-row");
  expect(summaryRow).not.toBeNull();
  const text = summaryRow!.textContent ?? "";
  expect(text).toMatch(/history/i);
  expect(text).toMatch(/lineage/i);
  expect(text).toMatch(/usage/i);
  expect(text).toMatch(/checkpoint/i);
});
```

- [ ] **Step 2: 跑测试失败**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx -t "Tab summaries row"
```

Expected: FAIL

- [ ] **Step 3: 在 Inspector Overview tab 内新增 Tab summaries row**

找到 SessionsPanel.tsx 中 Inspector Overview tab section（`hidden={activeInspectorTab !== "overview"}`），在 metadata 渲染分支末尾、`</section>` 之前插入 Tab summaries row：

```tsx
<section
  className="sessions-surface"
  hidden={activeInspectorTab !== "overview"}
  id="sessions-inspector-overview"
  role="tabpanel"
>
  <div className="sessions-section-heading">
    <h3>{t("metadata")}</h3>
    {selectedSession ? (
      <Badge variant={statusVariant(selectedSession.status)}>
        {selectedSession.status || t("unknown")}
      </Badge>
    ) : null}
  </div>
  {selectedSession ? (
    <>
      <strong>{selectedSession.key}</strong>
      <p className="sessions-note">
        {t("providerModelLine", {
          model: selectedSession.model || t("na"),
          provider: selectedSession.modelProvider || t("na"),
        })}
      </p>
      <p className="sessions-note">
        {t("thinkingFastMode", {
          fastMode: selectedSession.fastMode ? t("on") : t("off"),
          thinking: selectedSession.thinkingLevel || t("off"),
        })}
      </p>
      <div className="sessions-status-row">
        <Badge>{`history ${history?.messages?.length ?? 0}`}</Badge>
        <Badge variant={lineageState === "ready" ? "ok" : "neutral"}>
          {`lineage ${lineageState}`}
        </Badge>
        <Badge>{`usage ${formatCompactNumber(selectedTotalTokens)} tokens`}</Badge>
        <Badge>{`${selectedSession?.compactionCount ?? 0} checkpoint(s)`}</Badge>
      </div>
    </>
  ) : (
    <p className="sessions-empty">{t("noActiveSession")}</p>
  )}
</section>
```

注意：四个 pill 文案直接英文（对齐 prototype 截图里的 "usage 150 tokens / 1 checkpoint / no lineage links" 英文渲染），不动 i18n 文件。

- [ ] **Step 4: 跑测试通过**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: add Tab summaries row to inspector overview" deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx
```

---

## Task 5: Transcript 区域调整

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx`（Transcript section，约 872-969 行）
- Modify: `deck-go/frontend-new/src/components/panels/sessions/sessions-panel.css`（`.sessions-transcript-list` max-height + overflow）
- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx`

- [ ] **Step 1: 加 failing 断言（selected match 默认隐藏 + ExportPreview 默认不存在 / closed）**

```tsx
it("transcript: selected match Code is hidden by default and ExportPreview is not auto-open", async () => {
  renderPanel();
  await waitFor(() => {
    expect(screen.getByText(/Main Session/i)).toBeInTheDocument();
  });
  // 默认状态 transcriptSearchQuery 为空
  const transcriptSurface = Array.from(document.querySelectorAll(".sessions-surface")).find((s) =>
    s.querySelector("h3")?.textContent?.toLowerCase().includes("transcript"),
  );
  expect(transcriptSurface).not.toBeUndefined();
  // selected match Code 不存在（默认隐藏）
  expect(transcriptSurface!.querySelector('[aria-label="Selected transcript match"]')).toBeNull();
  // ExportPreview details 默认不存在或没有 open 属性
  const details = transcriptSurface!.querySelector("details.sessions-export-preview");
  if (details) {
    expect((details as HTMLDetailsElement).open).toBe(false);
  }
});
```

- [ ] **Step 2: 跑测试失败**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx -t "transcript: selected match"
```

Expected: FAIL

- [ ] **Step 3: 改 SessionsPanel.tsx：selected match Code 加条件渲染、ExportPreview details 去掉 `open`**

在 SessionsPanel.tsx 中找到这段（约 932-949 行）：

```tsx
{
  selectedTranscriptMatch ? (
    <Code
      aria-label="Selected transcript match"
      className="sessions-code"
      content={transcriptMessageToPlainText(selectedTranscriptMatch)}
    />
  ) : null;
}
{
  exportPreview ? (
    <details className="sessions-export-preview" open>
      <summary>{t("preparedExport", { format: exportPreview.format })}</summary>
      <Code
        aria-label={t("preparedExport", { format: exportPreview.format })}
        className="sessions-code"
        content={exportPreview.text}
        language={exportPreview.format}
      />
    </details>
  ) : null;
}
```

替换为：

```tsx
{
  selectedTranscriptMatch && transcriptSearchQuery.trim() !== "" ? (
    <Code
      aria-label="Selected transcript match"
      className="sessions-code"
      content={transcriptMessageToPlainText(selectedTranscriptMatch)}
    />
  ) : null;
}
{
  exportPreview ? (
    <details className="sessions-export-preview">
      <summary>{t("preparedExport", { format: exportPreview.format })}</summary>
      <Code
        aria-label={t("preparedExport", { format: exportPreview.format })}
        className="sessions-code"
        content={exportPreview.text}
        language={exportPreview.format}
      />
    </details>
  ) : null;
}
```

- [ ] **Step 4: 改 sessions-panel.css 加 `.sessions-transcript-list` max-height**

在 `sessions-panel.css` 末尾（在 `@media (max-width: 1320px)` 之前）加：

```css
.sessions-transcript-list {
  max-height: 96px; /* ≈ 2 行 row 高度（含 padding+gap），呼应 prototype 默认两条消息可见 */
  overflow-y: auto;
}
```

- [ ] **Step 5: 跑单元测试通过**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx
```

Expected: PASS（新断言通过；旧断言若有"selected match Code 总是渲染"或"ExportPreview default open"类的，按 spec 2.6 节"Transcript ExportPreview default open 断言：改为 default closed（或默认不存在）"+"selected match Code 块：默认（`transcriptSearchQuery` 空）时不可见的断言"更新它们。）

- [ ] **Step 6: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: gate selected match + collapse export preview + scrollable transcript list" deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx deck-go/frontend-new/src/components/panels/sessions/sessions-panel.css deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx
```

---

## Task 6: Inventory row 5 → 4 行 (删 previewText、行 4 改回 timestamp)

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx`（Inventory row 渲染，约 728-754 行）
- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx`

- [ ] **Step 1: 加 failing 断言**

```tsx
it("inventory row renders exactly 4 meta/note fields (not 5)", async () => {
  renderPanel();
  await waitFor(() => {
    expect(screen.getByText(/Main Session/i)).toBeInTheDocument();
  });
  const firstRow = document.querySelector(".sessions-inventory-list .sessions-inventory-row");
  expect(firstRow).not.toBeNull();
  // 行 1 strong+badge / 行 2 meta / 行 3 note / 行 4 meta，总共 4 个 .sessions-row-top + .sessions-meta + .sessions-note + .sessions-meta = 4 个 span 子级（不含 strong+Badge wrapper）
  const metaSpans = firstRow!.querySelectorAll(":scope > .sessions-meta, :scope > .sessions-note");
  expect(metaSpans.length).toBe(3); // .sessions-row-top 算第 1 行（含 strong+Badge）；下面 3 个直接 span（meta+note+meta）
});
```

注释：当前 5 行结构为 row-top + meta + note + meta + meta（5 个子节点），改为 4 行后是 row-top + meta + note + meta（4 个子节点），其中 row-top 含 strong+Badge，其他 3 个分别是 sessions-meta（agent|model|kind）、sessions-note（lastMessagePreview）、sessions-meta（timestamp）。

- [ ] **Step 2: 跑测试失败**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx -t "inventory row renders exactly 4"
```

Expected: FAIL（当前是 5 行字段）

- [ ] **Step 3: 改 SessionsPanel.tsx Inventory row**

找到约 728-754 行：

```tsx
<li key={session.key}>
  <button
    className={`sessions-inventory-row${selected ? " is-selected" : ""}`}
    type="button"
    onClick={() => onSelectSession(session)}
  >
    <span className="sessions-row-top">
      <strong>{session.title || session.label || session.key}</strong>
      <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
    </span>
    <span className="sessions-meta">
      {session.agentId || t("na")} | {session.modelProvider || t("na")}/{session.model || t("na")} |{" "}
      {inferSessionKind(session)}
    </span>
    <span className="sessions-note">{session.lastMessagePreview || "n/a"}</span>
    <span className="sessions-meta">{previewText(preview, session)}</span>
    <span className="sessions-meta">{formatTimestamp(session.updatedAt)}</span>
  </button>
</li>
```

替换为（删 `previewText` 那行）：

```tsx
<li key={session.key}>
  <button
    className={`sessions-inventory-row${selected ? " is-selected" : ""}`}
    type="button"
    onClick={() => onSelectSession(session)}
  >
    <span className="sessions-row-top">
      <strong>{session.title || session.label || session.key}</strong>
      <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
    </span>
    <span className="sessions-meta">
      {session.agentId || t("na")} | {session.modelProvider || t("na")}/{session.model || t("na")} |{" "}
      {inferSessionKind(session)}
    </span>
    <span className="sessions-note">{session.lastMessagePreview || "n/a"}</span>
    <span className="sessions-meta">{formatTimestamp(session.updatedAt)}</span>
  </button>
</li>
```

如果 `previewText` 仅在此处使用，删除函数定义（SessionsPanel.tsx 约 221-229 行）以避免 unused warning：

```tsx
function previewText(preview: SessionPreview | undefined, session: DeckGoSessionMeta) {
  const previewItems = preview?.items ?? [];
  const text = previewItems
    .map((item) => item.text)
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 2)
    .join(" / ");
  return text || session.lastMessagePreview || "n/a";
}
```

整段删除。同时检查 `SessionPreview` 类型 import 是否还有别处用——如果是，保留；否则也一并删除。

- [ ] **Step 4: 跑测试通过**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: collapse inventory row to 4 fields (drop duplicate preview)" deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx
```

---

## Task 7: Compactions metric hint fallback 文案

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx`（Compactions MetricTile，约 625-633 行）
- Modify: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx`

- [ ] **Step 1: 加 failing 断言**

```tsx
it("Compactions metric hint uses compaction.noCheckpoints when count is zero", async () => {
  renderPanel({ session: { ...mockSession, compactionCount: 0 } });
  await waitFor(() => {
    expect(screen.getByText(/Main Session/i)).toBeInTheDocument();
  });
  // 找含 "Compactions" 的 MetricTile，其 hint 应是 "No compaction checkpoints found"（en）
  const tiles = document.querySelectorAll(".sessions-metric");
  const compactionsTile = Array.from(tiles).find((tile) =>
    tile.textContent?.toLowerCase().includes("compactions"),
  );
  expect(compactionsTile).not.toBeUndefined();
  expect(compactionsTile!.textContent ?? "").toMatch(/no compaction checkpoints found/i);
  expect(compactionsTile!.textContent ?? "").not.toMatch(/runtime metadata/i);
});
```

注：测试需要支持 `renderPanel({ session: ... })` 注入零 compaction 的 mock。如果现有 `renderPanel` 不支持自定义 session，按现有测试基础设施（参考其他用例怎么注入 mock）调整：可能需要在 mock provider 层注入。最简方式是让默认 mock 改为 `compactionCount: 0`，或在测试里 mock `useSessionsListQuery` 返回值。

- [ ] **Step 2: 跑测试失败**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx -t "Compactions metric hint"
```

Expected: FAIL（当前 fallback 是 `t("runtimeMetadata")`）

- [ ] **Step 3: 改 SessionsPanel.tsx Compactions MetricTile**

找到约 625-633 行：

```tsx
<MetricTile
  label={t("compactions")}
  value={selectedSession?.compactionCount ?? 0}
  hint={
    (selectedSession?.compactionCount ?? 0) > 0 ? t("checkpointAvailable") : t("runtimeMetadata")
  }
/>
```

替换为：

```tsx
<MetricTile
  label={t("compactions")}
  value={selectedSession?.compactionCount ?? 0}
  hint={
    (selectedSession?.compactionCount ?? 0) > 0
      ? t("checkpointAvailable")
      : t("compaction.noCheckpoints")
  }
/>
```

验证 `t("compaction.noCheckpoints")` 解析正确：sessions provider scope 下，i18n key 是 `sessions.compaction.noCheckpoints`，对应 en.json:2263 "No compaction checkpoints found"。如果调用方式不对（取决于现有 `useTranslations` 嵌套规则），先在 dev console 验证字符串确实渲染。

- [ ] **Step 4: 跑测试通过**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: fix compactions metric hint fallback to compaction.noCheckpoints" deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.test.tsx
```

---

## Task 8: Scoped Token Override CSS

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/sessions/sessions-panel.css`（顶部新增 token override）

注：本 task 不加 unit test 断言（jsdom 不应用 CSS）。验证留给 Task 9 的 Playwright spec。本 task 单独 commit 是因为 CSS 改动独立、易回滚。

- [ ] **Step 1: 在 sessions-panel.css 顶部，紧随注释/license 之后，`.sessions-panel { ... }` 块之前，新增跨主题 override**

在 `.sessions-panel { display: grid; ... }` 块**之前**插入：

```css
/* Sessions visual parity overrides — see docs/superpowers/specs/2026-05-11-sessions-visual-parity-design.md
 * Scoped to .sessions-panel; CSS variables cascade to canonical atoms within this subtree.
 * Cross-theme: spacing / radius / font-size / line — sessions prototype is denser/larger than chat-pilot baseline. */
.sessions-panel {
  --ds-sp-2: 8px;
  --ds-sp-3: 12px;
  --ds-sp-4: 16px;
  --ds-sp-5: 24px;
  --ds-radius-md: 8px;
  --ds-fs-body: 13px;
  --ds-fs-meta: 11px;
  --ds-line: 1.45;
}

/* Dark-only: colors / shadow — keep light theme readable (canonical light text is dark on white). */
[data-theme="dark"] .sessions-panel {
  --ds-text-1: #f3f6fb;
  --ds-text-2: #c7d0dd;
  --ds-shadow-md: 0 14px 36px rgb(0 0 0 / 0.28);
}
```

- [ ] **Step 2: 单元测试无回归（CSS 不影响 jsdom 单元）**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx
```

Expected: PASS（所有用例）

- [ ] **Step 3: 浏览器人工 quick smoke**

启动 dev server（mock 模式）：

```bash
cd deck-go/frontend-new && pnpm dev
```

浏览器打开 `http://localhost:5175/?panel=sessions`（按 frontend-new 的 dev 入口确认实际 URL），dark theme，1440 viewport。直接目测：间距、卡片圆角、阴影应感觉跟 prototype 接近；切到 light 应不出现"白底白字"。

- [ ] **Step 4: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: scoped CSS token overrides for prototype visual parity (dark + cross-theme)" deck-go/frontend-new/src/components/panels/sessions/sessions-panel.css
```

---

## Task 9: 新增 sessions-visual-parity.spec.ts (Playwright)

**Files:**

- Create: `deck-go/test/e2e/sessions-visual-parity.spec.ts`

- [ ] **Step 1: 创建文件骨架**

新建 `deck-go/test/e2e/sessions-visual-parity.spec.ts`：

```ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

const thisFile = fileURLToPath(import.meta.url);
const deckRoot = path.resolve(path.dirname(thisFile), "../..");
const prototypeUrl = `file://${path.join(
  deckRoot,
  "frontend-handoff/modules/sessions/prototype.html",
)}`;

const SESSIONS_OVERRIDE_TOKENS = {
  "--ds-sp-2": "8px",
  "--ds-sp-3": "12px",
  "--ds-sp-4": "16px",
  "--ds-sp-5": "24px",
  "--ds-radius-md": "8px",
  "--ds-fs-body": "13px",
  "--ds-fs-meta": "11px",
  "--ds-line": "1.45",
} as const;

const SESSIONS_DARK_TOKENS = {
  "--ds-text-1": "rgb(243, 246, 251)",
  "--ds-text-2": "rgb(199, 208, 221)",
  "--ds-shadow-md": "rgba(0, 0, 0, 0.28) 0px 14px 36px 0px",
} as const;

const LIGHT_CANONICAL_TEXT_1 = "rgb(21, 23, 26)"; // #15171a — canonical light text-1

test.describe("sessions visual parity vs prototype", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("prototype dark/en/Overview matches sessions panel (mock-current)", async ({
    page,
  }, testInfo) => {
    const outputDir = testInfo.outputDir;
    const unexpected = collectUnexpectedErrors(page);
    const verdict: ParityVerdict = {
      status: "pass",
      score: 100,
      acceptedExceptions: [],
      assertions: [],
    };

    await page.setViewportSize({ width: 1440, height: 900 });

    // 1) Prototype screenshot
    await page.goto(prototypeUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      fullPage: false,
      path: path.join(outputDir, "prototype.png"),
    });

    // 2) Mock-current screenshot
    await openDeck(page, stack.frontendBase, "sessions", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });
    await expect(page.getByTestId("sessions-panel")).toBeVisible();
    await expect(page.getByText("Inventory ready").first()).toBeVisible();
    await expect(page.getByText("Detail ready").first()).toBeVisible();
    await expect(page.getByText("Main Session").first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      fullPage: false,
      path: path.join(outputDir, "mock-current.png"),
    });

    // 3) Token (dark + cross-theme) computed values
    for (const [token, expected] of Object.entries(SESSIONS_OVERRIDE_TOKENS)) {
      const actual = await readCssVariable(page, ".sessions-panel", token);
      const ok = actual.trim() === expected;
      verdict.assertions.push({ name: `token ${token}`, expected, actual, ok });
      expect(actual.trim(), `dark ${token}`).toBe(expected);
    }
    for (const [token, expected] of Object.entries(SESSIONS_DARK_TOKENS)) {
      const actual = await readCssVariable(page, ".sessions-panel", token);
      const ok = normalize(actual) === normalize(expected);
      verdict.assertions.push({ name: `dark token ${token}`, expected, actual, ok });
      expect(normalize(actual), `dark ${token}`).toBe(normalize(expected));
    }

    // 4) DOM 断言 — Hero 不再有 history/lineage badge
    const hero = page.locator(".sessions-hero");
    await expect(hero).toBeVisible();
    const heroStatusRowText = (await hero.locator(".sessions-status-row").textContent()) ?? "";
    expect(heroStatusRowText.toLowerCase(), "hero history").not.toContain("history");
    expect(heroStatusRowText.toLowerCase(), "hero lineage").not.toContain("lineage");
    verdict.assertions.push({
      name: "hero no history/lineage badge",
      expected: "absent",
      actual: heroStatusRowText,
      ok: true,
    });

    // 5) Hero stat-grid 4 个 stat
    const heroStats = hero.locator(".sessions-stat-grid .sessions-stat");
    await expect(heroStats).toHaveCount(4);
    verdict.assertions.push({ name: "hero stat count", expected: "4", actual: "4", ok: true });

    // 6) 不存在独立 Runtime metadata surface
    const runtimeMetadataHeading = page.locator(".sessions-surface h3", {
      hasText: /^runtime metadata$/i,
    });
    await expect(runtimeMetadataHeading).toHaveCount(0);
    verdict.assertions.push({
      name: "no runtime metadata surface",
      expected: "0",
      actual: "0",
      ok: true,
    });

    // 7) Inspector Overview Tab summaries row
    const overviewSummaryRow = page.locator("#sessions-inspector-overview .sessions-status-row");
    await expect(overviewSummaryRow).toBeVisible();
    const summaryText = (await overviewSummaryRow.textContent()) ?? "";
    expect(summaryText.toLowerCase()).toContain("history");
    expect(summaryText.toLowerCase()).toContain("lineage");
    expect(summaryText.toLowerCase()).toContain("usage");
    expect(summaryText.toLowerCase()).toContain("checkpoint");
    verdict.assertions.push({
      name: "overview tab summaries row",
      expected: "history+lineage+usage+checkpoint",
      actual: summaryText,
      ok: true,
    });

    // 8) Transcript: selected match Code 默认隐藏 + ExportPreview details 默认不展开
    const transcriptSurface = page.locator(".sessions-surface", {
      hasText: /transcript/i,
    });
    await expect(transcriptSurface.locator('[aria-label="Selected transcript match"]')).toHaveCount(
      0,
    );
    const exportDetailsCount = await transcriptSurface
      .locator("details.sessions-export-preview")
      .count();
    if (exportDetailsCount > 0) {
      const openAttr = await transcriptSurface
        .locator("details.sessions-export-preview")
        .first()
        .getAttribute("open");
      expect(openAttr).toBeNull();
    }
    verdict.assertions.push({
      name: "transcript default state",
      expected: "selected match hidden; export preview closed",
      actual: `match=0;detailsOpen=${exportDetailsCount > 0 ? "false" : "absent"}`,
      ok: true,
    });

    // 9) Transcript list max-height ≤ 110px
    const transcriptListMaxHeight = await page
      .locator(".sessions-transcript-list")
      .evaluate((el) => window.getComputedStyle(el).maxHeight);
    const maxHeightPx = Number.parseFloat(transcriptListMaxHeight);
    expect(maxHeightPx).toBeGreaterThan(0);
    expect(maxHeightPx).toBeLessThanOrEqual(110);
    verdict.assertions.push({
      name: "transcript list max-height",
      expected: "<=110px",
      actual: transcriptListMaxHeight,
      ok: true,
    });

    // 10) Inventory row 4 个 字段
    const firstInventoryRow = page
      .locator(".sessions-inventory-list .sessions-inventory-row")
      .first();
    const rowChildren = await firstInventoryRow.evaluate((el) => el.childElementCount);
    expect(rowChildren).toBe(4);
    verdict.assertions.push({
      name: "inventory row field count",
      expected: "4",
      actual: String(rowChildren),
      ok: true,
    });

    // 11) Compactions metric hint
    const compactionsTile = page.locator(".sessions-metric", { hasText: /compactions/i });
    const compactionsText = ((await compactionsTile.textContent()) ?? "").toLowerCase();
    expect(compactionsText).not.toContain("runtime metadata");
    verdict.assertions.push({
      name: "compactions hint not runtime metadata",
      expected: "absent",
      actual: compactionsText,
      ok: true,
    });

    // 12) Sheet (HTML 拼图 base64 + 截图)
    await page.setContent(
      `<!doctype html><html><head><style>
        body{margin:0;background:#0a0b0d;font-family:sans-serif;color:#fff;}
        .sheet{display:flex;gap:16px;padding:16px;}
        .col{flex:1;}
        img{width:100%;display:block;border:1px solid #262d3a;}
        h2{font-size:14px;margin:0 0 8px;color:#a8aeba;}
      </style></head><body><div class="sheet">
        <div class="col"><h2>prototype.png</h2><img src="prototype.png"/></div>
        <div class="col"><h2>mock-current.png</h2><img src="mock-current.png"/></div>
      </div></body></html>`,
      { baseURL: `file://${outputDir}/` },
    );
    await page.setViewportSize({ width: 2960, height: 1024 });
    await page.screenshot({ fullPage: true, path: path.join(outputDir, "sheet.png") });

    // 13) Verdict
    if (unexpected.length > 0) {
      verdict.status = "fail";
      verdict.score = Math.max(0, 100 - unexpected.length * 10);
      verdict.acceptedExceptions.push({
        area: "console / page errors",
        diff: unexpected.join("\n"),
        reason: "unexpected runtime error",
        owner: "claude",
      });
    }
    await writeFile(
      path.join(outputDir, "verdict.json"),
      JSON.stringify(verdict, null, 2),
      "utf-8",
    );

    expect(unexpected).toEqual([]);
  });
});

async function readCssVariable(page: Page, selector: string, name: string) {
  return page.evaluate(
    ({ selector, name }) => {
      const el = document.querySelector(selector);
      if (!el) return "";
      return window.getComputedStyle(el).getPropertyValue(name);
    },
    { selector, name },
  );
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

type ParityAssertion = {
  name: string;
  expected: string;
  actual: string;
  ok: boolean;
};

type ParityVerdict = {
  status: "pass" | "pass-with-exceptions" | "fail";
  score: number;
  acceptedExceptions: Array<{ area: string; diff: string; reason: string; owner: string }>;
  assertions: ParityAssertion[];
};

function collectUnexpectedErrors(page: Page) {
  const unexpected: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (message.text().startsWith("Failed to load resource:")) return;
      unexpected.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400 && response.url().includes("/api/")) {
      unexpected.push(`response: ${status} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.push(`pageerror: ${error.message}`);
  });
  return unexpected;
}
```

- [ ] **Step 2: 跑 spec 验证全部断言通过**

```bash
cd deck-go && pnpm exec playwright test test/e2e/sessions-visual-parity.spec.ts --config playwright.config.ts --reporter=line
```

Expected: 1 passed。如果有 assertion 失败：

- token 计算值不匹配 → 回 Task 8 检查 CSS scope 是否生效
- DOM 断言失败 → 回相应 task（1-7）检查实现
- 截图缺失 → 检查 outputDir 路径

- [ ] **Step 3: 检查输出 artifacts**

```bash
ls deck-go/test-results/sessions-visual-parity-*/sessions-vis* 2>/dev/null || \
  find deck-go -path "*sessions-visual-parity*" -name "*.png" -o -name "verdict.json" 2>/dev/null
```

Expected: 看到 `prototype.png` / `mock-current.png` / `sheet.png` / `verdict.json`。

- [ ] **Step 4: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: add prototype parity playwright spec with token/DOM assertions" deck-go/test/e2e/sessions-visual-parity.spec.ts
```

---

## Task 10: light theme smoke 子用例

**Files:**

- Modify: `deck-go/test/e2e/sessions-visual-parity.spec.ts`（追加 light 用例）

- [ ] **Step 1: 在 `test.describe` 块内追加 light theme 用例**

```ts
test("light theme: sessions does not regress (text readable, no errors) @light", async ({
  page,
}, testInfo) => {
  const outputDir = testInfo.outputDir;
  const unexpected = collectUnexpectedErrors(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await openDeck(page, stack.frontendBase, "sessions", stack.accessToken, {
    locale: "en",
    nav: "expanded",
    theme: "light",
  });
  await expect(page.getByTestId("sessions-panel")).toBeVisible();
  await expect(page.getByText("Main Session").first()).toBeVisible();
  await page.waitForTimeout(500);

  // spacing override 仍生效（跨主题）
  for (const [token, expected] of Object.entries(SESSIONS_OVERRIDE_TOKENS)) {
    const actual = await readCssVariable(page, ".sessions-panel", token);
    expect(actual.trim(), `light ${token}`).toBe(expected);
  }

  // colors 保持 canonical light（不被 dark override 污染）
  const lightText1 = await readCssVariable(page, ".sessions-panel", "--ds-text-1");
  expect(normalize(lightText1), "light --ds-text-1 should be canonical").toBe(
    LIGHT_CANONICAL_TEXT_1,
  );

  await page.screenshot({
    fullPage: false,
    path: path.join(outputDir, "mock-current-light.png"),
  });

  expect(unexpected).toEqual([]);
});
```

- [ ] **Step 2: 跑 spec 验证 light 用例通过**

```bash
cd deck-go && pnpm exec playwright test test/e2e/sessions-visual-parity.spec.ts --config playwright.config.ts --reporter=line
```

Expected: 2 passed（dark parity + light smoke）。如果 light 失败：

- token override 在 light 也生效 spacing → 应该 pass
- `--ds-text-1` 在 light 是 `rgb(243, 246, 251)`（亮色）而非 `rgb(21, 23, 26)`（暗色）→ 说明 dark guard 没生效，回 Task 8 检查 `[data-theme="dark"] .sessions-panel` 是否正确写在 dark-only override 上
- console / pageerror → 看 unexpected 数组诊断

- [ ] **Step 3: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "sessions: add light theme smoke @light case to parity spec" deck-go/test/e2e/sessions-visual-parity.spec.ts
```

---

## Task 11: Implementation-notes 追加 Visual parity 段

**Files:**

- Modify: `deck-go/frontend-handoff/modules/sessions/implementation-notes.md`

- [ ] **Step 1: 在文件末尾追加 `## Visual parity — 2026-05-11` 段**

打开 `deck-go/frontend-handoff/modules/sessions/implementation-notes.md`，在文件末尾追加：

```markdown
## Visual parity — 2026-05-11

OpenSpec / spec reference: `docs/superpowers/specs/2026-05-11-sessions-visual-parity-design.md`
Implementation plan: `docs/superpowers/plans/2026-05-11-sessions-visual-parity-plan.md`

| Field               | Value                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Module              | sessions                                                                                                                  |
| Evidence level      | `mock-prototype-parity`                                                                                                   |
| Command             | `cd deck-go && pnpm exec playwright test test/e2e/sessions-visual-parity.spec.ts --config playwright.config.ts`           |
| Artifact path       | `deck-go/test-results/sessions-visual-parity-*/` (含 `prototype.png` / `mock-current.png` / `sheet.png` / `verdict.json`) |
| Verdict/status      | （以最后一次成功跑出的 `verdict.json` 的 `status` 为准）                                                                  |
| Run id              | n/a（本 task 不创建 real seed）                                                                                           |
| Accepted exceptions | shell chrome 差异 / live fixture 时间戳数值差异（如有）                                                                   |

Deterministic fixes 本次完成：

- Hero 删除 history / lineage badges；新增 Hero stat-grid 4 个 stat（Input / Output / Model / Policy）。
- 删除独立 Runtime metadata surface（与 Hero stat-grid 重复）。
- Inspector Overview tab 新增 Tab summaries row（history / lineage / usage / checkpoint 4 个 pill）。
- Transcript：selected match Code 默认隐藏（仅 `transcriptSearchQuery` 非空时显示）；ExportPreview details 去掉默认 `open`；transcript list CSS `max-height ≈ 96px` + `overflow-y: auto`，DOM 仍保留 `slice(0, 8)` 数据。
- Inventory row 从 5 行字段降到 4 行（删 `previewText` 重复 meta）。
- Compactions metric tile 在 0 compaction 时 hint fallback 从 `t("runtimeMetadata")` 改为复用既有 `t("compaction.noCheckpoints")`。
- 新增 sessions-panel.css scoped CSS 变量 override：spacing / radius / fs / line 跨主题撑开；colors / shadow 仅在 `[data-theme="dark"]` 下覆盖，light theme 保持 canonical 配色避免白底白字。
- 新增 `test/e2e/sessions-visual-parity.spec.ts`：固定 1440x900 / dark / en / Overview tab；token computed values 断言、DOM 关键区域断言、prototype + mock-current 双截图、parity sheet 拼图、verdict.json 输出；含 `@light` smoke 用例验证 light theme 不回归。

Accepted exceptions：

- prototype.html 是独立单页，sessions 实际页面套在 Deck shell 内（NavRail / TopBar 占据左/上空间），导致 viewport 内 sessions 内容区域比 prototype 1440 略窄；这是 prototype 与生产 shell 的固有差异，不属于本 spec 修复范围。
- live mock fixture 的 timestamp / 数值（如 token / cost）跟 prototype 硬编码内容不同；这是数据差异而非视觉差异。
```

- [ ] **Step 2: Commit**

```bash
cd /Users/wangym/workspace/agents/openclaw && scripts/committer "handoff/sessions: record visual parity evidence 2026-05-11" deck-go/frontend-handoff/modules/sessions/implementation-notes.md
```

---

## 最终联合验证

所有 task 完成后，跑一次完整验证套件：

- [ ] **Step 1: 单元测试**

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx
```

Expected: 全部通过（含本计划新增的 6 个 IT 用例 + 既有 13 个用例的更新版本）。

- [ ] **Step 2: 既有 sessions visual spec 不回归**

```bash
cd deck-go && pnpm exec playwright test test/e2e/sessions-visual.spec.ts --config playwright.config.ts --reporter=line
```

Expected: 1 passed（既有 interaction state coverage）。如果失败，检查是否因为结构改动让某个 `getByText` / `getByRole` 选择器失效，更新选择器。

- [ ] **Step 3: 新增 parity spec**

```bash
cd deck-go && pnpm exec playwright test test/e2e/sessions-visual-parity.spec.ts --config playwright.config.ts --reporter=line
```

Expected: 2 passed（dark parity + light smoke）。

- [ ] **Step 4: Frontend build**

```bash
cd deck-go && make frontend-build
```

Expected: build 通过，无 TypeScript error。

- [ ] **Step 5: 视觉 verdict 检查**

打开 `deck-go/test-results/sessions-visual-parity-*/verdict.json`，确认 `status` 为 `pass` 或 `pass-with-exceptions`，且 `acceptedExceptions` 内不含 `spacing / chrome / typography / hero-stat-count / runtime-metadata-duplication / transcript-layer-overflow` 类条目（按 spec 3.4 节"accepted exceptions 限于 shell chrome / live fixture 时间戳与具体数值差异"）。

- [ ] **Step 6: 人工 dev server 并排验证**

```bash
cd deck-go/frontend-new && pnpm dev
```

浏览器开两个窗口：

1. dev server sessions 页面（dark / 1440 / Overview tab）
2. `file:///<absolute>/deck-go/frontend-handoff/modules/sessions/prototype.html`

并排目测，确认间距、卡片 chrome、字体、布局密度跟 prototype 接近，并切到 light 模式验证文字可读、无 overflow。

---

## 风险 / 故障预案

如果实施过程中遇到以下情况，先停下来检查再继续：

- **Vitest 单元测试 `renderPanel` 不支持注入零 compaction mock**：可能需要在 mock provider 层 mock `useSessionsListQuery` 等 hook。如果改 mock 设施比较复杂，把 Task 7 的 unit test 改写成观察现有 default mock 下的渲染（如果 default mock 已经有 `compactionCount > 0`，反过来断言：用 `selectedSession.compactionCount > 0` 时的 hint 不是 `runtime metadata`）。或者把这一项断言只放到 Playwright spec，单元测试只保 hint key 引用正确。
- **`t("compaction.noCheckpoints")` 在 sessions provider scope 下解析失败**：检查 useTranslations 的 namespace 嵌套规则；可能需要写成 `t("compaction.noCheckpoints")` 或 `useTranslations("sessions.compaction")(t("noCheckpoints"))`。fallback：直接硬编码英文 "No compaction checkpoints found"，或在 follow-up 中扩展 i18n util 支持嵌套 key（不在本 spec 范围）。
- **playwright `setContent` + `baseURL: file://...` 拼 sheet 加载图像失败**：fallback 是直接跳过 sheet 拼图（只保 prototype.png 和 mock-current.png 两张独立图，verdict.json 引用两个独立文件），把 sheet 标为 follow-up。
- **Transcript list `max-height: 96px` 经实际目测高度不对（太矮或太高）**：在 Task 8 之后做人工 quick smoke，按实际渲染调整到 88-110px 区间。
- **`SessionsPanel.test.tsx` 既有用例因为新结构大量失败**：spec 2.6 节列了 6 类需要更新的断言；按"removed assertion / updated structure"原则逐项修，commit message 写清楚改动来源。

---

## Self-review

本计划已对照 spec 自审：

- **覆盖**：spec Section 1 (12 项 token override) → Task 8 + 9；Section 2.1 (Hero / stat-grid / Runtime metadata / Transcript) → Task 1 / 2 / 3 / 5；Section 2.2 (Inventory) → Task 6；Section 2.3 (Inspector Overview Tab summaries) → Task 4；Section 2.4 (Compactions hint) → Task 7；Section 2.5 (Header) → spec 已注明不动；Section 2.6 (测试同步) → 散布在 Task 1-7 的 unit test 步骤；Section 3.1-3.4 (验证策略) → Task 9 + 10 + 最终联合验证；Section 风险 (transcript 限高 hint) → 风险预案段已记录可选添加。
- **无 placeholder**：每个 step 含具体 old/new 代码或命令；无 TBD / TODO。
- **类型一致**：所有 task 使用 `selectedSession` / `selectedTotalTokens` / `lineageState` / `history.messages.length` / `selectedSession.compactionCount` 这些 SessionsPanel.tsx 既有标识符；新增的 verdict 类型 `ParityVerdict` / `ParityAssertion` 在 Task 9 定义并在 Task 9-10 一致使用。
- **scope 一致**：所有改动文件落在 spec 第 25-29 行声明的 5 个文件/目录内，未扩散到 atoms、其他 panel、i18n 文件。
