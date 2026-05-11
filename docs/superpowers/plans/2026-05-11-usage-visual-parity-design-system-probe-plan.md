# Usage Visual Parity Design System Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 修正 usage 面板当前明显的视觉/token 漂移，并产出 usage + sessions 是否足够支撑 design system 提炼的判定证据。

**Architecture:** 先建立 usage fact baseline 和 prototype parity E2E，再在 `usage-panel.css` 内完成 canonical token cleanup 与 usage-scoped aliases，避免首轮改全局 design system。完成后把每个修复项分类为 `module-only` / `shared-candidate` / `promote-later` / `reject`，在 usage handoff notes 中输出 Design System Promotion Decision。

**Tech Stack:** React 19 / TypeScript / Vite / CSS variables / Vitest / Playwright / deck-go mock bundled stack。

**Implementation status - 2026-05-11:** Completed. The final E2E uses a local static HTTP server for `frontend-handoff/modules/usage/prototype.html` because usage's active prototype is a multi-file Babel React handoff and cannot be loaded correctly through `file://`. Final decision: **B - extract shared panel candidates later; do not change canonical tokens or atoms in this pass.**

---

## 文件结构

| 文件                                                                   | 操作   | 职责                                                                                      |
| ---------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `deck-go/frontend-handoff/modules/usage/implementation-notes.md`       | Modify | 记录 fact baseline、visual parity evidence、accepted exceptions、promotion classification |
| `deck-go/test/e2e/usage-visual-parity.spec.ts`                         | Create | prototype-vs-current 截图、token/CSS/DOM 断言、`verdict.json` 输出                        |
| `deck-go/frontend-new/src/components/panels/usage/usage-panel.css`     | Modify | 清理非 canonical `--ds-*` token 名称，新增 usage-scoped aliases，修正 surface/chrome 视觉 |
| `deck-go/frontend-new/src/components/panels/usage/UsagePanel.test.tsx` | Modify | 增加结构 smoke，锁住 usage 主视觉区域和不依赖非 canonical token 的约束                    |

不动：

- `deck-go/frontend-new/src/design-system/tokens/index.css`
- `deck-go/frontend-new/src/design-system/atoms/**`
- `deck-go/frontend-new/src/design-system/patterns/**`
- 其他 panel CSS / TSX
- usage API / Data Fabric / backend / contracts
- `package.json` 依赖

## 测试基础设施约定

`UsagePanel.test.tsx` 使用 React 19 `createRoot` 直挂模式，不使用 React Testing Library `render` 和 `screen`。

使用方式：

```tsx
await act(async () => {
  renderUsagePanel();
});
await waitFor(() => expect(apiMocks.fetchUsageSessions).toHaveBeenCalledTimes(1));
const panel = container.querySelector(".usage-panel");
expect(panel).not.toBeNull();
```

Playwright visual tests 从 `deck-go/` 目录运行：

```bash
pnpm exec playwright test --config playwright.config.ts test/e2e/usage-visual-parity.spec.ts
```

---

## Task 1: 建立 usage fact baseline

**Files:**

- Modify: `deck-go/frontend-handoff/modules/usage/implementation-notes.md`

- [x] **Step 1: 写入 fact baseline**

创建 `deck-go/frontend-handoff/modules/usage/implementation-notes.md`，内容为：

```md
# Usage implementation notes

## Visual parity fact baseline — 2026-05-11

| Classification     | Finding                                                                                               | Evidence                                                                                                                                                                                           | Decision                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| accepted           | Active usage visual target is the v2 multi-file prototype, not the archived v1 single-file prototype. | `deck-go/frontend-handoff/modules/usage/README.md` points `Visual target` to `./prototype.html`; `prototype-v1-codex.html` is labelled archive.                                                    | Use `frontend-handoff/modules/usage/prototype.html` for parity screenshots. |
| accepted           | Existing usage visual E2E is functional smoke, not prototype parity.                                  | `deck-go/test/e2e/usage-visual.spec.ts` opens the app, verifies text/interactions, and saves screenshots, but never opens `prototype.html`.                                                        | Add `usage-visual-parity.spec.ts`.                                          |
| accepted           | Production usage CSS uses non-canonical or stale visual token names.                                  | `usage-panel.css` contains `--ds-text`, `--ds-text-secondary`, `--ds-text-tertiary`, `--ds-surface`, `--ds-surface-muted`, `--ds-input-bg`, `--ds-accent-soft`, `--ds-danger`, and `--ds-warning`. | Replace with canonical `--ds-*` or usage-scoped aliases.                    |
| corrected          | The evidence does not prove global design-system tokens are wrong.                                    | Canonical tokens remain defined in `frontend-new/src/design-system/tokens/index.css`; usage production CSS is not consistently consuming them.                                                     | First fix usage locally; decide promotion after usage+sessions evidence.    |
| rejected           | Add `recharts` while fixing usage visual parity.                                                      | Usage README marks charts as dependency-gated and repo policy forbids new dependencies without explicit approval.                                                                                  | Keep current CSS/SVG chart primitives.                                      |
| rejected           | Directly modify all modules or global tokens in this pass.                                            | Only sessions has completed parity evidence; usage is the second sample.                                                                                                                           | Global changes require a later OpenSpec/design-system proposal.             |
| deferred-uncertain | Pixel-level chart fidelity and compact-density parity.                                                | Prototype defaults to `data-density="compact"`; current app may not expose per-module density.                                                                                                     | Record in verdict; do not force global density in this pass.                |
```

- [x] **Step 2: Verify baseline file exists**

Run:

```bash
test -f deck-go/frontend-handoff/modules/usage/implementation-notes.md && rg -n "Visual parity fact baseline|non-canonical|Design System" deck-go/frontend-handoff/modules/usage/implementation-notes.md
```

Expected: command prints matching baseline lines.

---

## Task 2: Add prototype parity E2E with a RED token-alias assertion

**Files:**

- Create: `deck-go/test/e2e/usage-visual-parity.spec.ts`

- [x] **Step 1: Create failing parity spec**

Create `deck-go/test/e2e/usage-visual-parity.spec.ts`:

```ts
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

const thisFile = fileURLToPath(import.meta.url);
const deckRoot = path.resolve(path.dirname(thisFile), "../..");
const prototypeUrl = `file://${path.join(deckRoot, "frontend-handoff/modules/usage/prototype.html")}`;
const usageCssPath = path.join(
  deckRoot,
  "frontend-new/src/components/panels/usage/usage-panel.css",
);

const STALE_USAGE_TOKEN_PATTERNS = [
  "var(--ds-text,",
  "var(--ds-text-secondary",
  "var(--ds-text-tertiary",
  "var(--ds-surface,",
  "var(--ds-surface-muted",
  "var(--ds-input-bg",
  "var(--ds-accent-soft",
  "var(--ds-danger",
  "var(--ds-warning",
] as const;

type ParityAssertion = {
  name: string;
  expected: string;
  actual: string;
  ok: boolean;
};

type PromotionCandidate = {
  area: string;
  candidate: string;
  evidence: string[];
  classification: "module-only" | "shared-candidate" | "promote-later" | "reject";
};

type UsageParityVerdict = {
  status: "pass" | "pass-with-exceptions" | "fail";
  domScore: number;
  domScoreNote: string;
  visualReview: {
    status: "pending-human" | "accepted" | "accepted-with-exceptions" | "needs-revision";
    screenshots: string[];
    notes?: string;
  };
  promotionCandidates: PromotionCandidate[];
  assertions: ParityAssertion[];
};

test.describe("usage visual parity vs prototype", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("prototype dark/en/default matches usage panel token and DOM intent", async ({
    page,
  }, testInfo) => {
    const outputDir = testInfo.outputDir;
    const unexpected = collectUnexpectedErrors(page);
    const verdict: UsageParityVerdict = {
      status: "pass",
      domScore: 100,
      domScoreNote: "DOM/token assertion pass rate; not a pixel score",
      visualReview: {
        status: "pending-human",
        screenshots: ["prototype.png", "mock-current.png", "usage-session-drilldown.png"],
      },
      promotionCandidates: [
        {
          area: "usage token aliases",
          candidate: "canonical token cleanup before global promotion",
          evidence: ["usage-panel.css primary visual path no longer uses stale --ds-* aliases"],
          classification: "module-only",
        },
        {
          area: "KPI/stat strip",
          candidate: "shared KpiStrip or PanelMetric pattern",
          evidence: ["sessions and usage both use top-level metric/stat grids"],
          classification: "shared-candidate",
        },
        {
          area: "provider quota rail",
          candidate: "provider quota primitive",
          evidence: ["usage-specific provider windows and quota bars"],
          classification: "module-only",
        },
      ],
      assertions: [],
    };

    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(prototypeUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({
      fullPage: false,
      path: path.join(outputDir, "prototype.png"),
    });

    await openDeck(page, stack.frontendBase, "usage", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });
    await expect(page.getByTestId("usage-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Usage operations cockpit" })).toBeVisible();
    await expect(page.getByText("Usage ready").first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      fullPage: false,
      path: path.join(outputDir, "mock-current.png"),
    });

    const cssSource = await readFile(usageCssPath, "utf8");
    for (const pattern of STALE_USAGE_TOKEN_PATTERNS) {
      const ok = !cssSource.includes(pattern);
      verdict.assertions.push({
        name: `no stale token pattern ${pattern}`,
        expected: "absent",
        actual: ok ? "absent" : "present",
        ok,
      });
      expect(cssSource, `stale token pattern ${pattern}`).not.toContain(pattern);
    }

    const tokenAssertions = {
      "--ds-text-1": "#e6e8ec",
      "--ds-text-2": "#a8aeba",
      "--ds-text-3": "#8992a3",
      "--ds-bg-1": "#0f1115",
      "--ds-bg-2": "#14171c",
      "--ds-border": "#262d3a",
    } as const;
    for (const [token, expected] of Object.entries(tokenAssertions)) {
      const actual = normalize(await readCssVariable(page, ".usage-panel", token));
      const ok = actual === expected;
      verdict.assertions.push({ name: `canonical token ${token}`, expected, actual, ok });
      expect(actual, `canonical token ${token}`).toBe(expected);
    }

    const panel = page.getByTestId("usage-panel");
    await expect(panel.locator(".usage-panel__metrics .usage-panel__metric")).toHaveCount(6);
    await expect(panel.locator(".usage-panel__workbench")).toBeVisible();
    await expect(panel.locator(".usage-panel__trend")).toBeVisible();
    await expect(panel.locator(".usage-panel__provider")).toBeVisible();
    await expect(panel.locator(".usage-panel__sessions")).toBeVisible();
    await expect(panel.locator(".usage-panel__evidence-grid")).toBeVisible();
    await expect(panel.locator(".usage-panel__sessions > .usage-panel__list > li")).toHaveCount(8);
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    verdict.assertions.push({
      name: "no horizontal overflow",
      expected: "true",
      actual: String(noOverflow),
      ok: noOverflow,
    });
    expect(noOverflow).toBe(true);

    await panel.getByPlaceholder("search usage sessions").fill("validation");
    await expect(panel.getByText("Builder validation")).toBeVisible();
    await panel.getByRole("button", { name: /Builder validation/ }).click();
    await expect(panel.getByText("Open usage session")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: path.join(outputDir, "usage-session-drilldown.png"),
    });

    expect(unexpected).toEqual([]);
    const failed = verdict.assertions.filter((assertion) => !assertion.ok);
    verdict.status = failed.length === 0 ? "pass" : "fail";
    verdict.domScore =
      verdict.assertions.length === 0
        ? 100
        : Math.round(
            ((verdict.assertions.length - failed.length) / verdict.assertions.length) * 100,
          );
    await writeFile(path.join(outputDir, "verdict.json"), `${JSON.stringify(verdict, null, 2)}\n`);
  });
});

async function readCssVariable(page: Page, selector: string, name: string) {
  return page.evaluate(
    ({ selector, name }) => {
      const el = document.querySelector(selector);
      if (!el) {
        return "";
      }
      return window.getComputedStyle(el).getPropertyValue(name);
    },
    { selector, name },
  );
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function collectUnexpectedErrors(page: Page) {
  const unexpected: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (message.text().startsWith("Failed to load resource:")) {
        return;
      }
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

- [x] **Step 2: Run the parity spec and verify RED**

Run:

```bash
cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/usage-visual-parity.spec.ts
```

Expected: FAIL with at least one message like `stale token pattern var(--ds-text,`.

---

## Task 3: Add unit guard for usage visual structure

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/usage/UsagePanel.test.tsx`

- [x] **Step 1: Add structure guard test**

Append this test inside the existing `describe("UsagePanel", () => { ... })` block:

```tsx
it("keeps usage visual structure ready for prototype parity", async () => {
  await act(async () => {
    renderUsagePanel();
  });

  await waitFor(() => expect(apiMocks.fetchUsageSessions).toHaveBeenCalledTimes(1));

  const panel = container.querySelector(".usage-panel");
  expect(panel).not.toBeNull();
  expect(panel!.className).toContain("deck-ui-usage");
  expect(panel!.querySelector(".usage-panel__header")).not.toBeNull();
  expect(panel!.querySelector(".usage-panel__metrics")).not.toBeNull();
  expect(panel!.querySelectorAll(".usage-panel__metric")).toHaveLength(6);
  expect(panel!.querySelector(".usage-panel__workbench")).not.toBeNull();
  expect(panel!.querySelector(".usage-panel__trend")).not.toBeNull();
  expect(panel!.querySelector(".usage-panel__provider")).not.toBeNull();
  expect(panel!.querySelector(".usage-panel__sessions")).not.toBeNull();
  expect(panel!.querySelector(".usage-panel__evidence-grid")).not.toBeNull();
});
```

- [x] **Step 2: Run focused unit test**

Run:

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/usage/UsagePanel.test.tsx -t "keeps usage visual structure"
```

Expected: PASS. This test locks structure but does not prove CSS parity.

---

## Task 4: Clean up stale usage CSS tokens and localize usage aliases

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/usage/usage-panel.css`

- [x] **Step 1: Replace the top `.usage-panel` block**

Replace the first block in `usage-panel.css` with:

```css
.usage-panel {
  --usage-bg-surface: var(--ds-bg-2);
  --usage-bg-muted: var(--ds-bg-3);
  --usage-bg-inset: var(--ds-bg-1);
  --usage-line-2: var(--ds-border);
  --usage-accent-1: var(--ds-accent);

  display: grid;
  gap: 14px;
  min-width: 0;
  max-width: none;
  margin: 0;
  color: var(--ds-text-1);
}
```

- [x] **Step 2: Apply exact token replacement map**

Use these replacements in `usage-panel.css`:

| Existing                                        | Replace with              |
| ----------------------------------------------- | ------------------------- |
| `var(--ds-text, var(--text-primary))`           | `var(--ds-text-1)`        |
| `var(--ds-text-secondary, var(--text-muted))`   | `var(--ds-text-2)`        |
| `var(--ds-text-tertiary, var(--text-faint))`    | `var(--ds-text-3)`        |
| `var(--ds-surface, var(--surface-elevated))`    | `var(--usage-bg-surface)` |
| `var(--ds-surface-muted, var(--surface))`       | `var(--usage-bg-muted)`   |
| `var(--ds-surface-muted, var(--primary-muted))` | `var(--usage-bg-muted)`   |
| `var(--ds-input-bg, var(--input-bg))`           | `var(--usage-bg-inset)`   |
| `var(--ds-accent-soft, var(--primary-muted))`   | `var(--ds-accent-bg)`     |
| `var(--ds-danger, var(--danger))`               | `var(--ds-error)`         |
| `var(--ds-warning, #b7791f)`                    | `var(--ds-warn)`          |
| `var(--ds-accent, var(--primary))`              | `var(--ds-accent)`        |
| `var(--ds-border, var(--border))`               | `var(--ds-border)`        |
| `var(--ds-success, var(--success))`             | `var(--ds-success)`       |

Where warm/hot status borders need a mixed tone, use `color-mix()` with `--ds-warn` / `--ds-error` and `--usage-line-2`; where current CSS only needs color fill, `--ds-warn` / `--ds-error` is enough.

- [x] **Step 3: Replace remaining stale status color usages**

After the map, these lines must no longer exist:

```bash
rg -n -- "var\\(--ds-text,|var\\(--ds-text-secondary|var\\(--ds-text-tertiary|var\\(--ds-surface|var\\(--ds-input-bg|var\\(--ds-accent-soft|var\\(--ds-danger|var\\(--ds-warning" deck-go/frontend-new/src/components/panels/usage/usage-panel.css
```

Expected: no matches.

- [x] **Step 4: Run CSS source guard through parity spec**

Run:

```bash
cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/usage-visual-parity.spec.ts
```

Expected: the stale token assertion no longer fails. If another assertion fails, keep the failure and use it to guide the next task.

---

## Task 5: Record design-system promotion decision

**Files:**

- Modify: `deck-go/frontend-handoff/modules/usage/implementation-notes.md`

- [x] **Step 1: Append promotion classification**

Append:

```md
## Design System Promotion Decision — 2026-05-11

**Decision:** B — first extract shared candidates later; do not change canonical tokens in the usage visual parity pass.

### Evidence

| Area                           | Classification     | Evidence                                                                                                                                                                    | Next step                                                                               |
| ------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Usage stale token aliases      | `module-only`      | The production usage CSS consumed non-canonical token names that current design-system tokens do not define. Fixing these is local cleanup, not global design-system proof. | Keep fixed in usage.                                                                    |
| KPI / stat strips              | `shared-candidate` | Sessions and usage both use prominent top-level metric grids that need consistent density, text hierarchy, and surface chrome.                                              | Candidate for a future `KpiStrip` / `PanelMetric` pattern after one more module sample. |
| Panel surface chrome           | `shared-candidate` | Sessions and usage both needed clearer surface/background/border hierarchy to approach prototype handoff.                                                                   | Candidate for a future `PanelSurface` pattern or surface token guidance.                |
| Usage provider quota rail      | `module-only`      | Provider windows, quota tones, and reset semantics are usage-specific.                                                                                                      | Keep in usage.                                                                          |
| Chart primitives               | `reject`           | Usage chart rendering is tied to usage cost/session data and remains dependency-gated for recharts.                                                                         | Do not promote in this pass.                                                            |
| Global canonical token changes | `promote-later`    | Two samples are not enough to safely rewrite global tokens; sessions also used scoped overrides by design.                                                                  | Revisit after a third module parity pass or a dedicated design-system OpenSpec.         |

### Rationale

The usage fix proves that some visual mismatch comes from module implementation drift rather than broken global tokens. Sessions and usage do share candidate primitives, but the evidence is not strong enough to change canonical tokens or atoms globally. The next design-system step should be a separate proposal for shared panel primitives, not a silent global token rewrite inside usage.
```

- [x] **Step 2: Verify notes contain final decision**

Run:

```bash
rg -n "Design System Promotion Decision|Decision.*B|shared-candidate|module-only|promote-later" deck-go/frontend-handoff/modules/usage/implementation-notes.md
```

Expected: command prints the new decision and classifications.

---

## Task 6: Final verification

**Files:**

- Verify only.

- [x] **Step 1: Run usage unit tests**

Run:

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/usage/UsagePanel.test.tsx
```

Expected: all `UsagePanel.test.tsx` tests pass.

- [x] **Step 2: Run usage existing visual smoke**

Run:

```bash
cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/usage-visual.spec.ts
```

Expected: existing usage visual smoke passes.

- [x] **Step 3: Run usage prototype parity spec**

Run:

```bash
cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/usage-visual-parity.spec.ts
```

Expected: parity spec passes and writes `verdict.json` under the Playwright output directory.

- [x] **Step 4: Review worktree diff**

Run:

```bash
git diff -- deck-go/frontend-new/src/components/panels/usage/usage-panel.css deck-go/frontend-new/src/components/panels/usage/UsagePanel.test.tsx deck-go/test/e2e/usage-visual-parity.spec.ts deck-go/frontend-handoff/modules/usage/implementation-notes.md docs/superpowers/specs/2026-05-11-usage-visual-parity-design-system-probe-design.md docs/superpowers/plans/2026-05-11-usage-visual-parity-design-system-probe-plan.md
```

Expected: diff only contains usage visual parity, evidence notes, spec, and plan changes.

## Completion report

Final report must include:

- Changed files.
- Verification commands and pass/fail result.
- Whether the final promotion decision is A, B, or C.
- Remaining visual risks, especially whether `visualReview.status` is still `pending-human`.
