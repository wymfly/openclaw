import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

const thisFile = fileURLToPath(import.meta.url);
const deckRoot = path.resolve(path.dirname(thisFile), "../..");
const prototypeRoot = path.join(deckRoot, "frontend-handoff/modules/usage");
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
  let prototypeServer: StaticPrototypeServer | undefined;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
    prototypeServer = await startStaticPrototypeServer(prototypeRoot);
  });

  test.afterAll(async () => {
    await prototypeServer?.stop();
    await stack?.stop();
  });

  test("prototype dark/en/default matches usage panel token and DOM intent", async ({
    page,
  }, testInfo) => {
    const outputDir = testInfo.outputDir;
    const verdict: UsageParityVerdict = {
      status: "pass",
      domScore: 100,
      domScoreNote: "DOM/token assertion pass rate; not a pixel score",
      visualReview: {
        status: "pending-human",
        screenshots: [
          "prototype.png",
          "mock-current.png",
          "usage-session-drilldown.png",
          "sheet.png",
        ],
        notes:
          "Prototype screenshot is best-effort because the active usage handoff loads React/Babel from external UMD scripts; production DOM/token/typography assertions are local and deterministic.",
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

    await page.goto(`${prototypeServer!.baseUrl}/prototype.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.screenshot({
      fullPage: false,
      path: path.join(outputDir, "prototype.png"),
    });

    const unexpected = collectUnexpectedErrors(page);
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

    const panelTypography = await page.locator(".usage-panel").evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        family: style.fontFamily,
        size: style.fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
      };
    });
    const typographyAssertions = {
      "usage font family": {
        expected: "Inter",
        actual: panelTypography.family,
        ok: panelTypography.family.includes("Inter"),
      },
      "usage font size": {
        expected: "13px",
        actual: panelTypography.size,
        ok: panelTypography.size === "13px",
      },
      "usage line height": {
        expected: "19.5px",
        actual: panelTypography.lineHeight,
        ok: panelTypography.lineHeight === "19.5px",
      },
      "usage letter spacing": {
        expected: "normal",
        actual: panelTypography.letterSpacing,
        ok: panelTypography.letterSpacing === "normal",
      },
    };
    for (const [name, assertion] of Object.entries(typographyAssertions)) {
      verdict.assertions.push({ name, ...assertion });
      expect(assertion.ok, `${name}: ${assertion.actual}`).toBe(true);
    }

    const typeScale = await page.locator(".usage-panel").evaluate((element) => {
      const readFontSize = (selector: string) => {
        const target = element.querySelector(selector);
        if (!target) {
          return "";
        }
        return window.getComputedStyle(target).fontSize;
      };
      return {
        cardTitle: readFontSize(".usage-panel__card-title"),
        metricValue: readFontSize(".ds-panel-metric__value"),
        title: readFontSize(".ds-panel-section-header__title"),
      };
    });
    const typeScaleAssertions = {
      "usage title font size": {
        expected: "19px",
        actual: typeScale.title,
        ok: typeScale.title === "19px",
      },
      "usage card title font size": {
        expected: "14px",
        actual: typeScale.cardTitle,
        ok: typeScale.cardTitle === "14px",
      },
      "usage metric value font size": {
        expected: "16px",
        actual: typeScale.metricValue,
        ok: typeScale.metricValue === "16px",
      },
    };
    for (const [name, assertion] of Object.entries(typeScaleAssertions)) {
      verdict.assertions.push({ name, ...assertion });
      expect(assertion.ok, `${name}: ${assertion.actual}`).toBe(true);
    }

    const panel = page.getByTestId("usage-panel");
    await expect(panel.locator(".ds-kpi-strip .ds-panel-metric")).toHaveCount(6);
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
    await writeVisualSheet(page, outputDir);

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

async function writeVisualSheet(page: Page, outputDir: string) {
  const sheetHtmlPath = path.join(outputDir, "sheet.html");
  await writeFile(
    sheetHtmlPath,
    `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :root {
            color-scheme: dark;
            background: #0b0d11;
            color: #e6e8ec;
            font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          }
          body { margin: 0; padding: 20px; }
          h1 { margin: 0 0 14px; font-size: 18px; font-weight: 600; letter-spacing: 0; }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }
          figure { margin: 0; border: 1px solid #262d3a; background: #14171c; }
          figcaption {
            padding: 8px 10px;
            color: #a8aeba;
            font-size: 12px;
            border-bottom: 1px solid #262d3a;
          }
          img { display: block; width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <h1>Usage visual parity sheet</h1>
        <div class="grid">
          <figure><figcaption>Prototype</figcaption><img src="prototype.png" /></figure>
          <figure><figcaption>Mock current</figcaption><img src="mock-current.png" /></figure>
          <figure>
            <figcaption>Session drilldown</figcaption>
            <img src="usage-session-drilldown.png" />
          </figure>
        </div>
      </body>
    </html>
  `,
    "utf8",
  );
  await page.setViewportSize({ width: 2960, height: 1024 });
  await page.goto(pathToFileURL(sheetHtmlPath).href);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    fullPage: true,
    path: path.join(outputDir, "sheet.png"),
  });
}

type StaticPrototypeServer = {
  baseUrl: string;
  stop: () => Promise<void>;
};

async function startStaticPrototypeServer(root: string): Promise<StaticPrototypeServer> {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const relativePath =
        requestUrl.pathname === "/"
          ? "prototype.html"
          : decodeURIComponent(requestUrl.pathname.slice(1));
      const filePath = path.resolve(root, relativePath);
      if (!filePath.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, { "content-type": contentType(filePath) });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function contentType(filePath: string) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".js") || filePath.endsWith(".jsx")) {
    return "text/javascript; charset=utf-8";
  }
  return "text/plain; charset=utf-8";
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
