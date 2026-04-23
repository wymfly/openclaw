import { chromium } from "playwright";

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error("[stage3-browser-smoke] usage: node smoke-stage3-browser.mjs <base-url>");
  process.exit(2);
}

const requiredTexts = ["Deck Go operator shell", "Gateway", "Runtime", "Chat"];

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  for (const text of requiredTexts) {
    const locator = page.getByText(text, { exact: false }).first();
    await locator.waitFor({ state: "visible", timeout: 15_000 });
  }

  console.log(
    `[stage3-browser-smoke] verified hydrated Vite host content at ${baseUrl}: ${requiredTexts.join(", ")}`,
  );
} finally {
  await browser.close();
}
