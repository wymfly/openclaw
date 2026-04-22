import { expect, test } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import {
  connectLiveGatewayClient,
  gatewayUrl,
  isDashboardServerReachable,
  liveSmokeEnabled,
  resolveGatewayToken,
} from "./live-helpers";

const gatewayToken = resolveGatewayToken();

test.describe("@live Deck chat controls", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("starts a live run, steers it, and aborts it from the chat UI", async ({
    page,
    request,
  }) => {
    test.skip(
      !(await isDashboardServerReachable(request)),
      "Dashboard server is not reachable at the configured base URL.",
    );

    await setEnglishLocale(page);

    const bootstrap = await request.post("/api/onboarding/save-settings", {
      data: {
        gatewayUrl,
        gatewayToken,
      },
    });
    expect(bootstrap.ok()).toBeTruthy();

    const createdSessionKeys: string[] = [];
    const startStreamingRun = async () => {
      await page.getByRole("button", { name: "New Session" }).click();
      await page
        .locator("[data-chat-input]")
        .fill("Write the word STREAMING 200 times, one per line, with no intro or summary.");

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/chat/sessions/create") &&
          response.request().method() === "POST",
        { timeout: 20_000 },
      );

      await page.getByRole("button", { name: "Send", exact: true }).click();

      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBeTruthy();
      const created = (await createResponse.json()) as {
        key?: string;
        status?: string;
        runStarted?: boolean;
      };
      expect(created.key).toBeTruthy();
      expect(created.status).toBe("started");
      expect(created.runStarted).toBe(true);
      createdSessionKeys.push(created.key as string);
      return created;
    };

    await gotoDashboard(page);
    const created = await startStreamingRun();

    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Steer" })).toBeVisible();

    const steerInput = page.getByPlaceholder("Enter instruction to redirect execution...");
    await steerInput.fill("Stop after one line and say STEER_OK.");

    const steerResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/chat/steer") && response.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Steer" }).click();
    const steerResponse = await steerResponsePromise;
    expect(steerResponse.ok()).toBeTruthy();
    const steerPayload = (await steerResponse.json()) as {
      status?: string;
      interruptedActiveRun?: boolean;
      runId?: string;
    };
    expect(steerPayload.status).toBe("started");
    expect(steerPayload.interruptedActiveRun).toBe(true);
    expect(steerPayload.runId).toBeTruthy();

    await page.waitForTimeout(1_000);

    if (!(await page.getByRole("button", { name: "Stop" }).isVisible().catch(() => false))) {
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await startStreamingRun();
      await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 15_000 });
    }

    const abortResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/chat/abort") && response.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Stop" }).click();
    const abortResponse = await abortResponsePromise;
    expect(abortResponse.ok()).toBeTruthy();
    const abortPayload = (await abortResponse.json()) as {
      ok?: boolean;
      status?: string;
      abortedRunId?: string;
    };
    expect(abortPayload.ok).toBe(true);
    expect(abortPayload.status).toBe("aborted");
    expect(abortPayload.abortedRunId).toBeTruthy();

    await expect(page.getByRole("button", { name: "Stop" })).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();

    for (const sessionKey of createdSessionKeys) {
      await request
        .delete("/api/chat/sessions", {
          data: {
            sessionKey,
          },
        })
        .catch(() => {});
    }
  });

  test("compacts a seeded session and records a compaction checkpoint", async ({
    page,
    request,
  }) => {
    test.skip(
      !(await isDashboardServerReachable(request)),
      "Dashboard server is not reachable at the configured base URL.",
    );

    await setEnglishLocale(page);

    const bootstrap = await request.post("/api/onboarding/save-settings", {
      data: {
        gatewayUrl,
        gatewayToken,
      },
    });
    expect(bootstrap.ok()).toBeTruthy();

    const label = `PW Compact UI ${Date.now()}`;
    const createResponse = await request.post("/api/chat/sessions/create", {
      data: {
        agentId: "main",
        label,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { key?: string };
    const sessionKey = created.key ?? "";
    expect(sessionKey).toBeTruthy();

    const client = await connectLiveGatewayClient("playwright-compact-ui");

    try {
      await client.request("chat.inject", {
        sessionKey,
        label: "Injected transcript",
        message: `# Compact UI Probe

This is a deterministic transcript payload for compacting via the browser slash command.
It contains enough words to create a meaningful checkpoint and lets the Stage 1 browser test
inspect compaction history after the action completes.`,
      });

      await gotoDashboard(page);
      await expect(page.getByPlaceholder("Search sessions...")).toBeVisible();
      await page.getByPlaceholder("Search sessions...").fill(label);
      await page.getByText(label, { exact: true }).click();

      const compactResult = await page.evaluate(async (activeSessionKey) => {
        const response = await fetch("/api/chat/compact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey: activeSessionKey }),
        });
        return {
          status: response.status,
          payload: await response.json().catch(() => null),
        };
      }, sessionKey);
      expect(compactResult.status).toBe(200);

      await setActivePanel(page, "sessions");
      await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();

      const sessionRow = page.locator("main button").filter({ hasText: label }).first();
      await expect(sessionRow).toBeVisible({ timeout: 15_000 });
      await sessionRow.click();

      await expect(page.getByText("Compaction History", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByText("Compaction History", { exact: true }).click();
      await expect(page.getByRole("button", { name: "Branch" }).first()).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await client.stopAndWait({ timeoutMs: 2_000 }).catch(() => client.stop());
      await request
        .delete("/api/chat/sessions", {
          data: {
            sessionKey,
          },
        })
        .catch(() => {});
    }
  });
});
