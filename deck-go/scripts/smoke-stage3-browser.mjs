import { chromium } from "playwright";

const baseUrl = process.argv[2];
const authToken = process.argv[3] ?? "";
const mode = process.argv[4] ?? "basic";

if (!baseUrl) {
  console.error("[stage3-browser-smoke] usage: node smoke-stage3-browser.mjs <base-url>");
  process.exit(2);
}

const requiredTexts = ["Deck Go operator shell"];
const panelChecks = [
  { navLabel: "Agents", panelTitles: ["Agents", "Agent detail"] },
  { navLabel: "Gateway", panelTitles: ["Gateway runtime", "Managed gateway settings"] },
  { navLabel: "Channels", panelTitles: ["Channel inventory"] },
  { navLabel: "Logs", panelTitles: ["Logs tail", "Live event tape"] },
  { navLabel: "Models", panelTitles: ["Models", "Models detail"] },
  { navLabel: "Config", panelTitles: ["Config", "Config detail"] },
  { navLabel: "Settings", panelTitles: ["Deck-go local settings", "Settings summary"] },
  { navLabel: "Sessions", panelTitles: ["Session inventory", "Session detail"] },
  { navLabel: "Plugins", panelTitles: ["Plugin inventory"] },
];

function formatSmokeDiagnostics(details) {
  const parts = [];
  if (details.visibleText) {
    parts.push(`Last visible text:\n${details.visibleText}`);
  }
  if (details.storage) {
    parts.push(`Browser storage:\n${JSON.stringify(details.storage, null, 2)}`);
  }
  if (details.streamTrace?.length) {
    parts.push(
      `Recent stream trace:\n${details.streamTrace.map((entry) => JSON.stringify(entry)).join("\n")}`,
    );
  }
  if (details.dialogTrace?.length) {
    parts.push(
      `Dialog trace:\n${details.dialogTrace.map((entry) => JSON.stringify(entry)).join("\n")}`,
    );
  }
  return parts.join("\n\n");
}

async function waitForMainText(page, predicate, timeoutMs, errorMessage, detailsProvider) {
  const deadline = Date.now() + timeoutMs;
  let visibleText = "";
  while (Date.now() < deadline) {
    visibleText = await page.locator("main").evaluate((node) => node.innerText);
    if (predicate(visibleText)) {
      return visibleText;
    }
    await page.waitForTimeout(1_000);
  }

  const extraDetails = (await detailsProvider?.()) ?? {};
  throw new Error(`${errorMessage}\n\n${formatSmokeDiagnostics({ visibleText, ...extraDetails })}`);
}

const browser = await chromium.launch({ headless: true });
const navigationOptions = { waitUntil: "commit", timeout: 15_000 };

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const streamTrace = [];
  const dialogTrace = [];
  let promptCount = 0;
  let unlockCount = 0;
  const pushTrace = (...entry) => {
    streamTrace.push(entry);
    if (streamTrace.length > 40) {
      streamTrace.shift();
    }
  };
  const pushDialogTrace = (...entry) => {
    dialogTrace.push(entry);
    if (dialogTrace.length > 20) {
      dialogTrace.shift();
    }
  };
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("__stream_") || text.includes("__replace_")) {
      pushTrace(["console", message.type(), text]);
    }
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/stream")) {
      pushTrace(["request", request.method(), request.url()]);
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/stream")) {
      pushTrace(["failed", request.url(), request.failure()?.errorText || "unknown"]);
    }
  });
  page.on("requestfinished", (request) => {
    if (request.url().includes("/api/stream")) {
      pushTrace(["finished", request.url()]);
    }
  });
  page.on("dialog", async (dialog) => {
    pushDialogTrace(["dialog", dialog.type(), dialog.message()]);
    if (dialog.type() === "prompt" && authToken.trim()) {
      promptCount += 1;
      await dialog.accept(authToken);
      return;
    }
    await dialog.dismiss();
  });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input instanceof Request
              ? input.url
              : JSON.stringify(input);
      if (url.includes("/api/stream")) {
        console.log("__stream_fetch__", url);
      }
      try {
        const response = await originalFetch(...args);
        if (url.includes("/api/stream")) {
          console.log("__stream_response__", url, response.status);
        }
        return response;
      } catch (error) {
        if (url.includes("/api/stream")) {
          console.log(
            "__stream_error__",
            url,
            error?.name || "Error",
            error?.message || String(error),
          );
        }
        throw error;
      }
    };

    const originalReplace = Location.prototype.replace.bind(window.location);
    Object.defineProperty(Location.prototype, "replace", {
      configurable: true,
      value: function (...replaceArgs) {
        console.log("__replace_called__", String(replaceArgs[0] ?? ""));
        return originalReplace(...replaceArgs);
      },
    });
  });

  const collectDiagnostics = async () => ({
    storage: await page.evaluate(() => ({
      lastEventId: window.localStorage.getItem("deckGoLastEventId"),
      accessToken: window.localStorage.getItem("deckGoAccessToken"),
      reloadAt: window.sessionStorage.getItem("deckGoStreamRecoveryReloadAt"),
      href: window.location.href,
    })),
    streamTrace,
    dialogTrace,
  });

  await page.goto(baseUrl, navigationOptions);

  if (authToken.trim()) {
    const unlockHeading = page.getByText("Unlock control plane", { exact: false }).first();
    const shellHeading = page.getByText("Deck Go operator shell", { exact: false }).first();
    const authDeadline = Date.now() + 15_000;
    while (Date.now() < authDeadline) {
      if (await shellHeading.isVisible().catch(() => false)) {
        break;
      }
      if (await unlockHeading.isVisible().catch(() => false)) {
        const tokenInput = page.getByPlaceholder("Enter deck-go access token");
        await tokenInput.fill(authToken);
        await page.waitForFunction(
          (value) => {
            const input = document.querySelector('input[placeholder="Enter deck-go access token"]');
            return input?.value === value;
          },
          authToken,
          { timeout: 5_000 },
        );
        await page.waitForTimeout(150);
        await page.getByRole("button", { name: "Unlock control plane" }).click();
        unlockCount += 1;
        break;
      }
      await page.waitForTimeout(500);
    }
  }

  await waitForMainText(
    page,
    (text) => requiredTexts.every((required) => text.includes(required)),
    20_000,
    "active host shell text never became visible",
    collectDiagnostics,
  );

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
      collectDiagnostics,
    );

    await page.context().setOffline(true);
    try {
      await waitForMainText(
        page,
        (text) => text.includes("Stream reconnecting"),
        20_000,
        "chat panel never exposed stream reconnecting after browser offline",
        collectDiagnostics,
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
      collectDiagnostics,
    );

    await page.reload(navigationOptions);
    await waitForMainText(
      page,
      (text) => text.includes(expectedAssistantReply),
      45_000,
      "assistant reply did not survive page reload",
      collectDiagnostics,
    );

    await page
      .locator(".deckgo-surface-label")
      .filter({ hasText: "Tool progress / run status" })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });

    await page.locator(".deckgo-restored-nav-item").filter({ hasText: "Settings" }).first().click();
    await page
      .locator("h2.deckgo-card-title")
      .filter({ hasText: "Deck-go local settings" })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/settings") &&
          response.request().method() === "PUT" &&
          response.status() === 200,
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: "Save settings" }).click(),
    ]);
    await page
      .locator("h2.deckgo-card-title")
      .filter({ hasText: "Last save result" })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });

    await page.locator(".deckgo-restored-nav-item").filter({ hasText: "Config" }).first().click();
    await page
      .locator("h2.deckgo-card-title")
      .filter({ hasText: "Config" })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/config/apply") &&
          response.request().method() === "POST" &&
          response.status() === 200,
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: "Apply config" }).click(),
    ]);
    await waitForMainText(
      page,
      (text) => text.includes("Deck Go operator shell") && text.includes("Config detail"),
      20_000,
      "active host did not remain visible after config apply",
      collectDiagnostics,
    );
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
    `[stage3-browser-smoke] verified hydrated Vite host content at ${baseUrl}: ${requiredTexts.join(", ")}; panels ${panelChecks.map((panel) => panel.navLabel).join(", ")}; mode ${mode}; auth unlocks ${unlockCount}; auth prompts ${promptCount}`,
  );
} finally {
  await browser.close();
}
