import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  authHeaders,
  buildRunScopedName,
  isRunScopedValue,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;

type CronJobFixture = {
  id: string;
  job: JsonObject;
  name: string;
  runId: string;
};

const CRON_REAL_VARIANTS = [
  {
    cancelLabel: "Cancel",
    closeLabel: "Close",
    deleteLabel: "Delete Job",
    editLabel: "Edit Job",
    historyLabel: "History",
    locale: "en" as const,
    navLabel: "Cron Jobs",
    newJobLabel: "New Job",
    readyLabel: "Cron ready",
    runNowLabel: "Run Now",
    scheduleLabel: "Schedule",
    schedulerLabel: "Scheduler",
    theme: "dark" as const,
    title: "Cron Jobs",
  },
  {
    cancelLabel: "取消",
    closeLabel: "关闭",
    deleteLabel: "删除任务",
    editLabel: "编辑任务",
    historyLabel: "历史",
    locale: "zh" as const,
    navLabel: "定时任务",
    newJobLabel: "新建任务",
    readyLabel: "Cron 就绪",
    runNowLabel: "立即运行",
    scheduleLabel: "调度",
    schedulerLabel: "调度器",
    theme: "dark" as const,
    title: "定时任务",
  },
  {
    cancelLabel: "Cancel",
    closeLabel: "Close",
    deleteLabel: "Delete Job",
    editLabel: "Edit Job",
    historyLabel: "History",
    locale: "en" as const,
    navLabel: "Cron Jobs",
    newJobLabel: "New Job",
    readyLabel: "Cron ready",
    runNowLabel: "Run Now",
    scheduleLabel: "Schedule",
    schedulerLabel: "Scheduler",
    theme: "light" as const,
    title: "Cron Jobs",
  },
  {
    cancelLabel: "取消",
    closeLabel: "关闭",
    deleteLabel: "删除任务",
    editLabel: "编辑任务",
    historyLabel: "历史",
    locale: "zh" as const,
    navLabel: "定时任务",
    newJobLabel: "新建任务",
    readyLabel: "Cron 就绪",
    runNowLabel: "立即运行",
    scheduleLabel: "调度",
    schedulerLabel: "调度器",
    theme: "light" as const,
    title: "定时任务",
  },
];

test.describe("cron real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Cron real Gateway E2E",
  );
  test.setTimeout(420_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    testInfo.setTimeout(420_000);
    stack = await startRealGatewayStack(testInfo);
  }, 420_000);

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies Cron route shapes, fixture CRUD, UI variants, and cleanup", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId =
      stack.realE2E?.runId ?? `deckgo-e2e-cron-w${testInfo.workerIndex}-r${testInfo.retry}`;
    const fixtures: CronJobFixture[] = [];
    const routeEvidence: JsonObject = { attempts: [], runId };
    const uiEvidence: JsonObject[] = [];
    let fixture: CronJobFixture | null = null;

    try {
      const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
      expect(runtime.ok(), `runtime gateway returned ${runtime.status()}`).toBe(true);
      routeEvidence.runtime = await jsonShape(runtime);

      const status = await request.get(`${stack.backendBase}/api/cron/status`, { headers });
      expect(status.ok(), `/api/cron/status returned ${status.status()}`).toBe(true);
      const statusPayload = await jsonShape(status);
      routeEvidence.status = {
        keys: Object.keys(statusPayload),
        runningType: typeof (statusPayload.running ?? statusPayload.enabled),
        status: status.status(),
      };
      expect(typeof (statusPayload.running ?? statusPayload.enabled ?? false)).toBe("boolean");

      const initial = await request.get(`${stack.backendBase}/api/cron?includeDisabled=true`, {
        headers,
      });
      expect(initial.ok(), `/api/cron returned ${initial.status()}`).toBe(true);
      const initialPayload = await jsonShape(initial);
      routeEvidence.initialList = {
        count: Array.isArray(initialPayload.jobs) ? initialPayload.jobs.length : 0,
        keys: Object.keys(initialPayload),
        status: initial.status(),
      };
      expect(Array.isArray(initialPayload.jobs)).toBe(true);

      fixture = await createCronFixture(request, stack, runId, "cron-real-disabled");
      if (fixture) {
        fixtures.push(fixture);
        routeEvidence.created = { id: fixture.id, name: fixture.name };

        const patched = await request.patch(
          `${stack.backendBase}/api/cron/${encodeURIComponent(fixture.id)}`,
          {
            data: {
              description: `${fixture.name} patched ${runId}`,
              enabled: false,
            },
            headers,
          },
        );
        expect(patched.ok(), `/api/cron patch returned ${patched.status()}`).toBe(true);
        const patchedPayload = await jsonShape(patched);
        expect(isRunScopedValue(patchedPayload, runId)).toBe(true);
        fixture.job = patchedPayload;
        routeEvidence.patched = {
          keys: Object.keys(patchedPayload),
          status: patched.status(),
        };

        const filtered = await request.get(
          `${stack.backendBase}/api/cron?includeDisabled=true&query=${encodeURIComponent(runId)}`,
          { headers },
        );
        expect(filtered.ok(), `/api/cron filtered returned ${filtered.status()}`).toBe(true);
        const filteredPayload = await jsonShape(filtered);
        const filteredJobs = Array.isArray(filteredPayload.jobs) ? filteredPayload.jobs : [];
        expect(filteredJobs.some((job) => isRunScopedValue(job, runId))).toBe(true);
        routeEvidence.filteredList = {
          count: filteredJobs.length,
          status: filtered.status(),
        };

        const runs = await request.get(
          `${stack.backendBase}/api/cron/${encodeURIComponent(fixture.id)}/runs?limit=5&sortDir=desc`,
          { headers },
        );
        expect(runs.ok(), `/api/cron/:id/runs returned ${runs.status()}`).toBe(true);
        const runsPayload = await jsonShape(runs);
        expect(Array.isArray(runsPayload.entries)).toBe(true);
        routeEvidence.runs = {
          count: Array.isArray(runsPayload.entries) ? runsPayload.entries.length : 0,
          keys: Object.keys(runsPayload),
          status: runs.status(),
        };
      } else {
        routeEvidence.fixtureStatus = "handoff-blocked";
      }

      routeEvidence.runNowPolicy = {
        route: "POST /api/cron/{jobId}/run",
        status: "skipped-safe",
        reason: "manual run may trigger operator workload; UI verifies disabled fallback only",
      };

      for (const variant of CRON_REAL_VARIANTS) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const unexpected = recordUnexpected(page, stack.backendBase);
        const directGateway = recordDirectGateway(page, stack);

        try {
          await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
            locale: variant.locale,
            nav: "expanded",
            theme: variant.theme,
          });

          const cronNav = page
            .locator(".deck-ui-rail")
            .getByRole("button", { exact: true, name: variant.navLabel });
          await cronNav.scrollIntoViewIfNeeded();
          await cronNav.click();
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "cron");
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("cron-panel");
          await expect(panel).toBeVisible();
          await expect(panel.getByRole("heading", { name: variant.title }).first()).toBeVisible();
          await expect
            .poll(async () => {
              const ready = await panel.getByText(variant.readyLabel).count();
              const empty = await panel.getByText(/No cron jobs yet|暂无定时任务/).count();
              return ready + empty;
            })
            .toBeGreaterThan(0);

          await panel.locator(".cron-panel__sort select").selectOption("name");
          await panel.locator(".cron-panel__search input").fill(runId);
          if (fixture) {
            await expect(panel.getByText(fixture.name).first()).toBeVisible();
            const fixtureRow = panel.locator(".cron-panel__job-row").filter({
              hasText: fixture.name,
            });
            await expect(fixtureRow.first()).toBeVisible();
            await fixtureRow.first().click();
            await expect(panel.getByText(fixture.id).first()).toBeVisible();
          } else {
            await expect(panel.getByText(/No jobs match|没有任务匹配/).first()).toBeVisible();
            await panel.locator(".cron-panel__search input").fill("");
          }

          await panel.getByRole("tab", { exact: true, name: variant.scheduleLabel }).click();
          await expect(panel.getByText(/Next-fire preview|下一次触发预览/).first()).toBeVisible();

          await panel.getByRole("tab", { name: variant.historyLabel }).click();
          await expect(
            panel.getByText(/Run History|运行历史|No runs yet|暂无运行记录/).first(),
          ).toBeVisible();

          await panel.getByRole("tab", { exact: true, name: variant.schedulerLabel }).click();
          await expect(panel.getByText(/read-only|只读/i).first()).toBeVisible();

          await panel.getByRole("button", { name: variant.newJobLabel }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.getByRole("dialog").getByRole("button", { name: variant.closeLabel }).click();

          if (fixture) {
            await panel.getByRole("button", { name: variant.editLabel }).click();
            await expect(page.getByRole("dialog")).toBeVisible();
            await page
              .getByRole("dialog")
              .getByRole("button", { name: variant.closeLabel })
              .click();

            await expect(panel.getByRole("button", { name: variant.runNowLabel })).toBeDisabled();

            await panel.getByRole("button", { name: variant.deleteLabel }).click();
            await expect(page.getByRole("dialog")).toBeVisible();
            await page
              .getByRole("dialog")
              .getByRole("button", { name: variant.cancelLabel })
              .click();
          }

          await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
          expect(unexpected.consoleErrors).toEqual([]);
          expect(unexpected.pageErrors).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);

          uiEvidence.push({
            fixture: fixture?.name ?? null,
            locale: variant.locale,
            navigation: "chat-to-cron",
            runNow: fixture ? "disabled-fixture-skipped-safe" : "no-fixture-skipped-safe",
            surfaces: [
              "search",
              "sort",
              "schedule",
              "history",
              "scheduler",
              "builder",
              "edit",
              "delete",
            ],
            theme: variant.theme,
          });
        } finally {
          await context.close();
        }
      }
    } finally {
      routeEvidence.cleanup = await cleanupCronFixtures(request, stack, fixtures);
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "cron-real-product-surface",
      {
        cleanup: routeEvidence.cleanup,
        routeEvidence,
        runId,
        scenarioId: "cron.real.product-surface",
        status: fixture ? "passed" : "handoff-blocked",
        uiEvidence,
      },
      testInfo,
    );
  });
});

async function createCronFixture(
  request: APIRequestContext,
  stack: E2EStack,
  runId: string,
  label: string,
): Promise<CronJobFixture | null> {
  const headers = authHeaders(stack.accessToken);
  const name = buildRunScopedName(runId, label);
  const attempts = [
    {
      name,
      schedule: { kind: "at", at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: `${name} system event` },
      agentId: "main",
      description: `${name} disabled disposable cron fixture`,
      enabled: false,
    },
    {
      name: `${name}-cron`,
      schedule: { kind: "cron", expr: "0 3 * * *", tz: "UTC" },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: `${name} cron fallback` },
      agentId: "main",
      description: `${name} disabled disposable cron fallback`,
      enabled: false,
    },
  ];

  for (const input of attempts) {
    const response = await request.post(`${stack.backendBase}/api/cron`, {
      data: input,
      headers,
    });
    const payload = await jsonShape(response);
    if (response.ok()) {
      const id = typeof payload.id === "string" ? payload.id : "";
      expect(id, "created cron fixture must expose an id").toBeTruthy();
      expect(isRunScopedValue(payload, runId), "created cron fixture must be run scoped").toBe(
        true,
      );
      return { id, job: payload, name: input.name, runId };
    }
    const errorText = JSON.stringify(payload);
    if (
      response.status() < 500 ||
      /invalid cron\.add params|invalid schedule\.at/i.test(errorText)
    ) {
      throw new Error(
        `cron fixture create rejected deterministic input: ${response.status()} ${errorText}`,
      );
    }
  }

  return null;
}

async function cleanupCronFixtures(
  request: APIRequestContext,
  stack: E2EStack,
  fixtures: CronJobFixture[],
) {
  const cleanup: JsonObject[] = [];
  const headers = authHeaders(stack.accessToken);
  for (const fixture of fixtures) {
    if (!isRunScopedValue(fixture.job, fixture.runId)) {
      throw new Error(
        `refusing to clean up cron job without current real E2E run id ${fixture.runId}`,
      );
    }
    const deleted = await request.delete(
      `${stack.backendBase}/api/cron/${encodeURIComponent(fixture.id)}`,
      { headers },
    );
    const payload = await jsonShape(deleted);
    expect(deleted.ok(), `/api/cron delete returned ${deleted.status()}`).toBe(true);
    cleanup.push({
      id: fixture.id,
      name: fixture.name,
      payload,
      status: "deleted",
    });
  }
  return cleanup;
}

async function jsonShape(response: { json: () => Promise<unknown>; status: () => number }) {
  try {
    const payload = await response.json();
    return typeof payload === "object" && payload !== null
      ? (payload as JsonObject)
      : { value: payload };
  } catch {
    return { status: response.status() };
  }
}

function recordUnexpected(page: Page, backendBase: string) {
  const unexpected = {
    apiErrors: [] as string[],
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
  };
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      unexpected.consoleErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.pageErrors.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (url.startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.apiErrors.push(`response: ${status} ${url}`);
    }
  });
  return unexpected;
}

function recordDirectGateway(page: Page, stack: E2EStack) {
  const direct = {
    requests: [] as string[],
    websockets: [] as string[],
  };
  page.on("request", (request) => {
    if (stack.realGateway?.url && request.url().startsWith(stack.realGateway.url)) {
      direct.requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    const gatewayUrl = stack.realGateway?.url;
    const gatewayWebsocketUrl = gatewayUrl?.replace(/^http/i, "ws");
    if (
      (gatewayUrl && websocket.url().startsWith(gatewayUrl)) ||
      (gatewayWebsocketUrl && websocket.url().startsWith(gatewayWebsocketUrl))
    ) {
      direct.websockets.push(websocket.url());
    }
  });
  return direct;
}
