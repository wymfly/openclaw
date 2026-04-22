import { expect, test, type APIRequestContext } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import {
  deckGoApiBase,
  gatewayUrl,
  isDashboardServerReachable,
  isDeckGoServerReachable,
  liveSmokeEnabled,
  resolveGatewayToken,
} from "./live-helpers";

const gatewayToken = resolveGatewayToken();

type MonitorRunsResponse = {
  runs?: Array<{
    runId?: string;
    sessionKey?: string;
  }>;
};

type ActivityResponse = {
  events?: Array<{
    id?: string;
    description?: string;
    details?: string;
  }>;
};

async function readRuns(request: APIRequestContext, sessionKey: string) {
  const response = await request.get(
    `${deckGoApiBase}/api/monitor/runs?sessionKey=${encodeURIComponent(sessionKey)}&limit=5`,
    { failOnStatusCode: false },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as MonitorRunsResponse;
}

async function readActivity(request: APIRequestContext) {
  const response = await request.get(`${deckGoApiBase}/api/activity?limit=20`, {
    failOnStatusCode: false,
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as ActivityResponse;
}

test.describe("@live Deck monitor/activity", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("shows a live run in Monitor and synthesized activity in Activity", async ({
    page,
    request,
  }) => {
    test.skip(
      !(await isDashboardServerReachable(request)),
      "Dashboard server is not reachable at the configured base URL.",
    );
    test.skip(
      !(await isDeckGoServerReachable(request)),
      "deck-go backend is not reachable at the configured API base URL.",
    );

    await setEnglishLocale(page);

    const bootstrap = await request.post("/api/onboarding/save-settings", {
      data: {
        gatewayUrl,
        gatewayToken,
      },
    });
    expect(bootstrap.ok()).toBeTruthy();

    const createResponse = await request.post("/api/chat/sessions/create", {
      data: {
        agentId: "main",
        label: `PW Monitor ${Date.now()}`,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { key?: string };
    const sessionKey = created.key ?? "";
    expect(sessionKey).toBeTruthy();

    const subscribeResponse = await request.post("/api/chat/session-events", {
      data: {
        action: "subscribe",
        sessionKey,
      },
    });
    expect(subscribeResponse.ok()).toBeTruthy();

    const sendResponse = await request.post("/api/chat/send", {
      data: {
        sessionKey,
        message: "Reply with exactly MONITOR_ACTIVITY_OK",
      },
    });
    expect(sendResponse.ok()).toBeTruthy();
    const sendPayload = (await sendResponse.json()) as { runId?: string; status?: string };
    expect(sendPayload.status).toBe("started");

    let runId = sendPayload.runId ?? "";
    let activityDescription = "";

    await expect
      .poll(async () => {
        const runs = await readRuns(request, sessionKey);
        const activity = await readActivity(request);
        const matchingRun = (runs.runs ?? []).find((item) => item.sessionKey === sessionKey);
        const matchingActivity = (activity.events ?? []).find((event) =>
          String(event.details ?? "").includes(sessionKey),
        );
        if (matchingRun?.runId) {
          runId = matchingRun.runId;
        }
        if (matchingActivity?.description) {
          activityDescription = matchingActivity.description;
        }
        return Boolean(matchingRun?.runId) && Boolean(matchingActivity?.description);
      }, { timeout: 30_000, intervals: [1_000, 2_000] })
      .toBe(true);

    expect(runId).toBeTruthy();
    expect(activityDescription).toBeTruthy();

    await gotoDashboard(page);
    await setActivePanel(page, "gateway");

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByRole("textbox", { name: "" }).first()).toBeVisible();

    const runRow = page.locator("div[role='button']").filter({ hasText: runId.slice(0, 12) }).first();
    await expect(runRow).toBeVisible({ timeout: 15_000 });
    await runRow.click();

    await expect(page.getByText("Run Timeline", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(runId, { exact: true })).toBeVisible();

    await setActivePanel(page, "activity");
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(page.getByText(activityDescription, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(sessionKey, { exact: false }).first()).toBeVisible();

    await request
      .delete("/api/chat/sessions", {
        data: {
          sessionKey,
        },
      })
      .catch(() => {});
  });
});
