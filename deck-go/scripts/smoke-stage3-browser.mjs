import { chromium } from "playwright";

const baseUrl = process.argv[2];
const authToken = process.argv[3] ?? "";

if (!baseUrl) {
  console.error("[stage3-browser-smoke] usage: node smoke-stage3-browser.mjs <base-url>");
  process.exit(2);
}

const requiredTexts = ["Deck Go operator shell", "Gateway", "Runtime", "Chat"];
const panelChecks = [
  { navLabel: "Agents", panelTitles: ["Agents", "Agent detail"] },
  { navLabel: "Gateway", panelTitles: ["Gateway runtime", "Managed gateway settings"] },
  { navLabel: "Channels", panelTitles: ["Channel inventory"] },
  { navLabel: "Logs", panelTitles: ["Logs tail", "Live event tape"] },
  { navLabel: "Models", panelTitles: ["Models", "Models detail"] },
  { navLabel: "Config", panelTitles: ["Config", "Config detail"] },
  { navLabel: "Sessions", panelTitles: ["Session inventory", "Session detail"] },
  { navLabel: "Plugins", panelTitles: ["Plugin inventory"] },
];

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  if (authToken.trim()) {
    await page.addInitScript((token) => {
      window.localStorage.setItem("deckGoAccessToken", token);
    }, authToken);
  }
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  for (const text of requiredTexts) {
    const locator = page.getByText(text, { exact: false }).first();
    await locator.waitFor({ state: "visible", timeout: 15_000 });
  }

  for (const panel of panelChecks) {
    await page
      .locator(".deckgo-restored-nav-item")
      .filter({ hasText: panel.navLabel })
      .first()
      .click();
    for (const panelTitle of panel.panelTitles) {
      await page
        .locator("h2.deckgo-card-title")
        .filter({ hasText: panelTitle })
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
    }
  }

  console.log(
    `[stage3-browser-smoke] verified hydrated Vite host content at ${baseUrl}: ${requiredTexts.join(", ")}; panels ${panelChecks.map((panel) => panel.navLabel).join(", ")}`,
  );
} finally {
  await browser.close();
}
