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

type RuntimePayload = {
  ok?: boolean;
  runtime?: {
    status?: string;
    health?: string;
    gatewayUrl?: string;
  };
};

async function readRuntime(request: APIRequestContext) {
  const response = await request.get(`${deckGoApiBase}/api/runtime/gateway`, {
    failOnStatusCode: false,
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as RuntimePayload;
}

test.describe("@live Deck gateway lifecycle", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("shows live runtime state and restarts the managed gateway from the UI", async ({
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

    const before = await readRuntime(request);
    expect(before.runtime?.gatewayUrl).toBeTruthy();

    await gotoDashboard(page);
    await setActivePanel(page, "gateway");

    await expect(page.getByRole("heading", { name: "Monitor" })).toBeVisible();
    await expect(page.getByText("Connection", { exact: true })).toBeVisible();

    await setActivePanel(page, "settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Managed Gateway Runtime", { exact: true })).toBeVisible();
    await expect(page.getByText(before.runtime?.gatewayUrl ?? "", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(/Runtime:\s+(Running|Starting|Degraded|Stopping|Stopped|Failed)/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh runtime" })).toBeVisible();

    const restartButton = page.getByRole("button", { name: "Restart" }).first();
    await expect(restartButton).toBeEnabled();

    const restartResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${deckGoApiBase}/api/runtime/gateway/restart` &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );

    await restartButton.click();

    const restartResponse = await restartResponsePromise;
    expect(restartResponse.ok()).toBeTruthy();
    const restartPayload = (await restartResponse.json()) as RuntimePayload;
    expect(restartPayload.runtime?.gatewayUrl).toBe(before.runtime?.gatewayUrl);
    expect(["starting", "running"]).toContain(restartPayload.runtime?.status ?? "");

    await expect
      .poll(
        async () => {
          const runtime = await readRuntime(request);
          return `${runtime.runtime?.status ?? "unknown"}:${runtime.runtime?.health ?? "unknown"}`;
        },
        { timeout: 30_000, intervals: [1_000, 2_000] },
      )
      .toBe("running:healthy");

    await expect(page.getByText("Health: Healthy", { exact: false })).toBeVisible({
      timeout: 15_000,
    });
  });
});
