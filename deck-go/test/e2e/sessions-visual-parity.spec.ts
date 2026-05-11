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
  "--ds-text-1": "#f3f6fb",
  "--ds-text-2": "#c7d0dd",
  "--ds-shadow-md": "0 14px 36px rgb(0 0 0 / 0.28)",
} as const;

// Canonical light --ds-text-1 (from src/design-system/tokens/index.css [data-theme="light"]).
// The dark scoped override must NOT leak into light theme, so we assert this in @light smoke.
const LIGHT_CANONICAL_TEXT_1 = "#15171a";

type ParityAssertion = {
  name: string;
  expected: string;
  actual: string;
  ok: boolean;
};

type ParityVerdict = {
  status: "pass" | "pass-with-exceptions" | "fail";
  /** DOM / token assertion pass rate (0-100). Not a pixel-visual percentage. */
  domScore: number;
  domScoreNote: string;
  /** Visual % vs prototype is owned by human side-by-side review. */
  visualReview: {
    status: "pending-human" | "accepted" | "accepted-with-exceptions" | "needs-revision";
    screenshots: string[];
    reviewer?: string;
    reviewedAt?: string;
    notes?: string;
  };
  acceptedExceptions: Array<{ area: string; diff: string; reason: string; owner: string }>;
  assertions: ParityAssertion[];
};

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
      domScore: 100,
      domScoreNote: "DOM/token assertion pass rate (not a pixel-visual percentage)",
      visualReview: {
        status: "pending-human",
        screenshots: ["prototype.png", "mock-current.png", "sheet.png"],
      },
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

    // 3) Token (cross-theme + dark) computed values
    for (const [token, expected] of Object.entries(SESSIONS_OVERRIDE_TOKENS)) {
      const actual = (await readCssVariable(page, ".sessions-panel", token)).trim();
      const ok = actual === expected;
      verdict.assertions.push({ name: `token ${token}`, expected, actual, ok });
      expect(actual, `dark ${token}`).toBe(expected);
    }
    for (const [token, expected] of Object.entries(SESSIONS_DARK_TOKENS)) {
      const actual = await readCssVariable(page, ".sessions-panel", token);
      const ok = normalize(actual) === normalize(expected);
      verdict.assertions.push({ name: `dark token ${token}`, expected, actual, ok });
      expect(normalize(actual), `dark ${token}`).toBe(normalize(expected));
    }

    // 4) Hero status-row 不再有 history/lineage badge
    const hero = page.locator(".sessions-hero");
    await expect(hero).toBeVisible();
    const heroStatusRowText = (await hero.locator(".ds-panel-status-row").textContent()) ?? "";
    expect(heroStatusRowText.toLowerCase(), "hero history").not.toContain("history");
    expect(heroStatusRowText.toLowerCase(), "hero lineage").not.toContain("lineage");
    verdict.assertions.push({
      name: "hero no history/lineage badge",
      expected: "absent",
      actual: heroStatusRowText,
      ok: true,
    });

    // 5) Hero stat-grid 4 个 stat
    const heroStatGrid = hero.locator(".ds-kpi-strip").first();
    const heroStats = hero.locator(".ds-kpi-strip .ds-panel-metric");
    await expect(heroStats).toHaveCount(4);
    verdict.assertions.push({ name: "hero stat count", expected: "4", actual: "4", ok: true });
    const heroStatColumns = await heroStatGrid.evaluate((element) => {
      const value = window.getComputedStyle(element).gridTemplateColumns.trim();
      return {
        value,
        count: value === "" || value === "none" ? 0 : value.split(/\s+/).length,
      };
    });
    verdict.assertions.push({
      name: "hero stat grid columns",
      expected: "4",
      actual: `${heroStatColumns.count} (${heroStatColumns.value})`,
      ok: heroStatColumns.count === 4,
    });
    expect(heroStatColumns.count, `hero stat grid columns: ${heroStatColumns.value}`).toBe(4);

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
    const overviewSummaryRow = page.locator("#sessions-inspector-overview .ds-panel-status-row");
    await expect(overviewSummaryRow).toBeVisible();
    const summaryText = (await overviewSummaryRow.textContent()) ?? "";
    expect(summaryText.toLowerCase()).toContain("history");
    expect(summaryText.toLowerCase()).toContain("lineage");
    expect(summaryText.toLowerCase()).toContain("usage");
    expect(summaryText.toLowerCase()).toContain("compaction");
    verdict.assertions.push({
      name: "overview tab summaries row",
      expected: "history+lineage+usage+compaction",
      actual: summaryText,
      ok: true,
    });

    // 8) Transcript: selected match Code 默认隐藏 + ExportPreview details 默认不展开
    const transcriptSurface = page.locator(".sessions-surface", { hasText: /transcript/i });
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

    // 10) Inventory row 4 个字段
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
    const compactionsTile = page.locator(".ds-panel-metric", { hasText: /compactions/i });
    const compactionsText = ((await compactionsTile.textContent()) ?? "").toLowerCase();
    expect(compactionsText).not.toContain("runtime metadata");
    verdict.assertions.push({
      name: "compactions hint not runtime metadata",
      expected: "absent",
      actual: compactionsText,
      ok: true,
    });

    // 12) Sheet (HTML 拼图 + 截图)
    // Write the comparison HTML to disk so the page origin is file:// (otherwise
    // a `setContent()`-loaded page is blocked from loading local image resources).
    const sheetHtmlPath = path.join(outputDir, "sheet.html");
    await writeFile(
      sheetHtmlPath,
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
      "utf-8",
    );
    await page.setViewportSize({ width: 2960, height: 1024 });
    await page.goto(`file://${sheetHtmlPath}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ fullPage: true, path: path.join(outputDir, "sheet.png") });

    // 13) Verdict — fold domScore from assertion results; console errors flagged separately
    const totalAssertions = verdict.assertions.length;
    const passed = verdict.assertions.filter((a) => a.ok).length;
    verdict.domScore = totalAssertions === 0 ? 0 : Math.round((passed / totalAssertions) * 100);
    if (passed < totalAssertions) {
      verdict.status = "fail";
    }
    if (unexpected.length > 0) {
      verdict.status = "fail";
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

    // spacing / radius / fs / line overrides cross-theme — still active under light
    for (const [token, expected] of Object.entries(SESSIONS_OVERRIDE_TOKENS)) {
      const actual = await readCssVariable(page, ".sessions-panel", token);
      expect(actual.trim(), `light ${token}`).toBe(expected);
    }

    // colors stay canonical light (dark-only override must not bleed through)
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
