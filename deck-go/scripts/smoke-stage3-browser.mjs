import { chromium } from "playwright";

const baseUrl = process.argv[2];
const authToken = process.argv[3] ?? "";
const mode = process.argv[4] ?? "basic";

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

async function waitForMainText(page, predicate, timeoutMs, errorMessage) {
  const deadline = Date.now() + timeoutMs;
  let visibleText = "";
  while (Date.now() < deadline) {
    visibleText = await page.locator("main").evaluate((node) => node.innerText);
    if (predicate(visibleText)) {
      return visibleText;
    }
    await page.waitForTimeout(1_000);
  }

  throw new Error(`${errorMessage}\n\nLast visible text:\n${visibleText}`);
}

const browser = await chromium.launch({ headless: true });
const navigationOptions = { waitUntil: "commit", timeout: 15_000 };

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  if (authToken.trim()) {
    await page.addInitScript((token) => {
      window.localStorage.setItem("deckGoAccessToken", token);
    }, authToken);
  }
  await page.goto(baseUrl, navigationOptions);

  for (const text of requiredTexts) {
    const locator = page.getByText(text, { exact: false }).first();
    await locator.waitFor({ state: "visible", timeout: 15_000 });
  }

  if (mode === "rich") {
    const chatMessage = "What number comes immediately after 314158? Reply with digits only.";
    const expectedAssistantReply = "314159";
    const messageBox = page.getByPlaceholder("Send a message through the restored chat panel");
    await messageBox.fill(chatMessage);
    await page.getByRole("button", { name: "Send message" }).click();

    await waitForMainText(
      page,
      (text) => text.includes(expectedAssistantReply),
      45_000,
      "assistant reply never appeared in visible transcript content",
    );

    await page.context().setOffline(true);
    try {
      await waitForMainText(
        page,
        (text) => text.includes("Stream reconnecting"),
        20_000,
        "chat panel never exposed stream reconnecting after browser offline",
      );
    } finally {
      await page.context().setOffline(false);
    }

    await waitForMainText(
      page,
      (text) =>
        text.includes(expectedAssistantReply) &&
        (text.includes("stream reconnected") || text.includes("Stream connected")),
      30_000,
      "assistant transcript or reconnect evidence did not recover after browser network restore",
    );

    await page.reload(navigationOptions);
    await waitForMainText(
      page,
      (text) => text.includes(expectedAssistantReply),
      45_000,
      "assistant reply did not survive page reload",
    );

    await page
      .locator(".deckgo-surface-label")
      .filter({ hasText: "Tool progress / run status" })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
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
    `[stage3-browser-smoke] verified hydrated Vite host content at ${baseUrl}: ${requiredTexts.join(", ")}; panels ${panelChecks.map((panel) => panel.navLabel).join(", ")}; mode ${mode}`,
  );
} finally {
  await browser.close();
}
