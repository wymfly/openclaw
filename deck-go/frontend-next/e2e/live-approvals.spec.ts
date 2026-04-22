import { expect, test, type APIRequestContext } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import {
  connectLiveGatewayClient,
  deckGoApiBase,
  gatewayUrl,
  isDashboardServerReachable,
  isDeckGoServerReachable,
  liveSmokeEnabled,
  resolveGatewayToken,
} from "./live-helpers";

const gatewayToken = resolveGatewayToken();

type PendingApproval = {
  id: string;
  command: string;
};

async function requestApproval(params: {
  requester: Awaited<ReturnType<typeof connectLiveGatewayClient>>;
  approvalId: string;
  command: string;
}) {
  const response = await params.requester.request("exec.approval.request", {
    id: params.approvalId,
    command: params.command,
    commandArgv: params.command.split(" "),
    systemRunPlan: {
      argv: params.command.split(" "),
      cwd: null,
      commandText: params.command,
      agentId: "main",
      sessionKey: "agent:main:main",
    },
    cwd: null,
    nodeId: "node-playwright",
    host: "node",
    timeoutMs: 60_000,
    twoPhase: true,
  });

  expect(response.status).toBe("accepted");
  expect(response.id).toBe(params.approvalId);
}

async function readPendingApprovals(request: APIRequestContext) {
  const response = await request.get(`${deckGoApiBase}/api/approvals/pending`, {
    failOnStatusCode: false,
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { pending?: PendingApproval[] };
  return payload.pending ?? [];
}

test.describe("@live Deck approvals", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("shows a pending approval and resolves it from the UI", async ({ page, request }) => {
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

    const watcher = await connectLiveGatewayClient("playwright-approvals-watcher");
    const requester = await connectLiveGatewayClient("playwright-approvals-requester");

    const approvalId = `pw-approval-${Date.now()}`;
    const command = "echo playwright-approval";

    try {
      await requestApproval({ requester, approvalId, command });

      await expect
        .poll(async () => {
          const pending = await readPendingApprovals(request);
          return pending.some((item) => item.id === approvalId);
        })
        .toBe(true);

      await gotoDashboard(page);
      await setActivePanel(page, "approvals");

      await expect(page.getByRole("heading", { name: "Approvals & Security" })).toBeVisible();
      await expect(page.getByText(command, { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Approve" }).first().click();

      await expect
        .poll(async () => {
          const pending = await readPendingApprovals(request);
          return pending.some((item) => item.id === approvalId);
        })
        .toBe(false);

      await expect(page.getByText("No pending approvals", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await requester.stopAndWait({ timeoutMs: 2_000 }).catch(() => requester.stop());
      await watcher.stopAndWait({ timeoutMs: 2_000 }).catch(() => watcher.stop());
    }
  });

  test("re-hydrates pending approvals after a full page reload", async ({ page, request }) => {
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

    const watcher = await connectLiveGatewayClient("playwright-approvals-refresh-watcher");
    const requester = await connectLiveGatewayClient("playwright-approvals-refresh-requester");

    const approvalId = `pw-approval-refresh-${Date.now()}`;
    const command = "echo playwright-approval-refresh";

    try {
      await requestApproval({ requester, approvalId, command });

      await expect
        .poll(async () => {
          const pending = await readPendingApprovals(request);
          return pending.some((item) => item.id === approvalId);
        })
        .toBe(true);

      await gotoDashboard(page);
      await setActivePanel(page, "approvals");
      await expect(page.getByText(command, { exact: true })).toBeVisible();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("nav")).toBeVisible();
      await setActivePanel(page, "approvals");
      await expect(page.getByRole("heading", { name: "Approvals & Security" })).toBeVisible();
      await expect(page.getByText(command, { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Approve" }).first().click();

      await expect
        .poll(async () => {
          const pending = await readPendingApprovals(request);
          return pending.some((item) => item.id === approvalId);
        })
        .toBe(false);
    } finally {
      await requester.stopAndWait({ timeoutMs: 2_000 }).catch(() => requester.stop());
      await watcher.stopAndWait({ timeoutMs: 2_000 }).catch(() => watcher.stop());
    }
  });
});
