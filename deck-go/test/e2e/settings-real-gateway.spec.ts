import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import {
  assertRunScopedCleanupTarget,
  authHeaders,
  buildRunScopedName,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;
type RouteEvidence = {
  body: string;
  label: string;
  ok: boolean;
  payload: JsonObject;
  status: number;
};
type SettingsFixtureAttempt = {
  status: "attempted" | "skipped-safe";
  method: string;
  runId: string;
  fixtureDevice?: JsonObject;
  originalPairedDevices?: unknown[];
  reason?: string;
};

test.describe("settings real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Settings real Gateway E2E",
  );
  test.setTimeout(300_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("creates run-scoped Settings fixture data and verifies safe route shapes", async ({
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const fixture = await createSettingsFixture(request, stack, "settings-api", testInfo);

    try {
      const settings = await expectOkJson(
        await request.get(`${stack.backendBase}/api/settings`, { headers }),
        "/settings",
      );
      expect(settings.ok).toBe(true);
      const settingsPayload = asRecord(settings.settings, "settings.settings");
      expect(settingsPayload.accessToken).toBeUndefined();
      expect(settingsPayload.managedGateway).toBeUndefined();
      expect(typeof settings.path).toBe("string");
      expect(findRunScopedLocalDevice(settingsPayload, fixture.runId)).toBeTruthy();

      const rejectedSave = await request.put(`${stack.backendBase}/api/settings`, {
        headers,
        data: { accessToken: "must-not-be-accepted" },
      });
      expect(rejectedSave.status(), "settings rejects secret/supervisor fields").toBe(400);
      const rejectedSaveBody = await rejectedSave.json();
      expect(asRecord(rejectedSaveBody, "rejected settings save").code).toBe(
        "invalid_settings_field",
      );

      const version = await expectOkJson(
        await request.get(`${stack.backendBase}/api/settings/version`, { headers }),
        "/settings/version",
      );
      expect(version).toBeTruthy();

      const bootstrap = await expectOkJson(
        await request.get(`${stack.backendBase}/api/bootstrap/status`, { headers }),
        "/bootstrap/status",
      );
      expect(bootstrap.ok).toBe(true);
      expect(typeof bootstrap.runtime).toBe("object");

      const capabilities = await expectOkJson(
        await request.get(`${stack.backendBase}/api/runtime/capabilities`, { headers }),
        "/runtime/capabilities",
      );
      expect(capabilities.mode).toBe("bundled");
      expect(typeof capabilities.endpointMutable).toBe("boolean");

      const endpoint = await expectOkJson(
        await request.get(`${stack.backendBase}/api/runtime/endpoint`, { headers }),
        "/runtime/endpoint",
      );
      expect(typeof endpoint.url).toBe("string");
      expect(typeof endpoint.tokenConfigured).toBe("boolean");
      expect(typeof endpoint.tlsVerify).toBe("boolean");

      const endpointTest = await expectOkOrDegraded(
        request,
        stack,
        "POST /runtime/endpoint:test",
        "POST",
        "/api/runtime/endpoint:test",
        {},
        [400, 405, 502, 503],
      );

      let endpointMutation: RouteEvidence | null = null;
      if (capabilities.endpointMutable === false) {
        endpointMutation = await expectOkOrDegraded(
          request,
          stack,
          "PUT /runtime/endpoint immutable rejection",
          "PUT",
          "/api/runtime/endpoint",
          {
            token: "__unchanged__",
            tlsVerify: endpoint.tlsVerify,
            url: endpoint.url,
          },
          [405],
        );
        expect(endpointMutation.ok).toBe(false);
        expect(endpointMutation.status).toBe(405);
      }

      const devices = await expectOkOrDegraded(
        request,
        stack,
        "GET /devices",
        "GET",
        "/api/devices",
        undefined,
        [400, 404, 501, 502, 503],
      );
      if (devices.ok) {
        expect(Array.isArray(devices.payload.pending ?? [])).toBe(true);
        expect(Array.isArray(devices.payload.paired ?? [])).toBe(true);
      }

      const selfDevice = await expectOkOrDegraded(
        request,
        stack,
        "GET /devices/self",
        "GET",
        "/api/devices/self",
        undefined,
        [400, 404, 501, 502, 503],
      );
      if (selfDevice.ok) {
        expect(
          selfDevice.payload.deviceId === null || typeof selfDevice.payload.deviceId === "string",
        ).toBe(true);
      }

      await writeRealE2EScenarioEvidence(
        stack,
        "settings-api-fixture",
        {
          scenarioId: "settings-api-fixture",
          runId: fixture.runId,
          status: "passed",
          fixture,
          routeShapes: {
            bootstrapRuntimeMode: asRecord(bootstrap.runtime, "bootstrap runtime").mode,
            deviceList: { status: devices.status, ok: devices.ok },
            endpointMutable: capabilities.endpointMutable,
            endpointMutation,
            endpointSource: endpoint.source,
            endpointTest: { status: endpointTest.status, ok: endpointTest.ok },
            selfDevice: { status: selfDevice.status, ok: selfDevice.ok },
            settingsPath: settings.path,
            versionKeys: Object.keys(version),
          },
          unsafeMutations: {
            accessTokenSaveRejected: true,
            deviceTokenMutation: "skipped-safe",
          },
        },
        testInfo,
      );
    } finally {
      await restoreSettingsFixture(request, stack, fixture);
    }
  });

  test("renders Settings UI variants through shell navigation with real fixture evidence", async ({
    browser,
    request,
  }, testInfo) => {
    const fixture = await createSettingsFixture(request, stack, "settings-ui", testInfo);
    const variants = [
      {
        appearance: "Appearance",
        expectedTitle: "Settings",
        fixtureLabel: fixture.fixtureDevice?.name as string,
        locale: "en" as const,
        navLabel: "Settings",
        runtime: "Runtime",
        saveDialog: "Save settings",
        search: "runtime",
        settingsReady: "Settings ready",
        theme: "dark" as const,
        devices: "Paired devices",
      },
      {
        appearance: "外观",
        expectedTitle: "设置",
        fixtureLabel: fixture.fixtureDevice?.name as string,
        locale: "zh" as const,
        navLabel: "设置",
        runtime: "运行时",
        saveDialog: "保存设置",
        search: "运行",
        settingsReady: "设置就绪",
        theme: "light" as const,
        devices: "已配对设备",
      },
    ];
    const variantEvidence: JsonObject[] = [];

    try {
      for (const variant of variants) {
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

          await page.getByRole("button", { exact: true, name: variant.navLabel }).click();
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
            "data-active-panel",
            "settings",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("settings-panel");
          await expect(
            panel.getByRole("heading", { name: variant.expectedTitle }).first(),
          ).toBeVisible();
          await expect(panel.getByText(variant.settingsReady).first()).toBeVisible();

          await panel.getByPlaceholder(/Search|搜索/).fill(variant.search);
          await expect(
            panel.getByRole("tab", { name: new RegExp(escapeRegExp(variant.runtime)) }),
          ).toBeVisible();
          await panel.getByPlaceholder(/Search|搜索/).fill("");

          await panel.getByRole("tab", { name: new RegExp(escapeRegExp(variant.runtime)) }).click();
          await expect(panel.getByTestId("endpoint-section")).toBeVisible();

          await panel
            .getByRole("tab", { name: new RegExp(escapeRegExp(variant.appearance)) })
            .click();
          await panel
            .getByRole("radio", { name: variant.locale === "en" ? "Light" : "浅色" })
            .click();
          await expect(panel.getByText(/unsaved|未保存/).first()).toBeVisible();
          await panel
            .getByRole("button", { name: /Save|保存/ })
            .first()
            .click();
          await expect(page.getByRole("dialog", { name: variant.saveDialog })).toBeVisible();
          await page
            .getByRole("dialog", { name: variant.saveDialog })
            .getByRole("button", { name: variant.locale === "en" ? "Close" : "关闭" })
            .click();

          await panel.getByRole("tab", { name: new RegExp(escapeRegExp(variant.devices)) }).click();
          await expect(panel.getByText(variant.fixtureLabel).first()).toBeVisible();

          await expect.poll(() => unexpected.slice()).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);

          variantEvidence.push({
            locale: variant.locale,
            theme: variant.theme,
            nav: "chat -> settings",
            interactions: [
              "section search",
              "runtime section",
              "appearance dirty state",
              "save dialog",
              "local paired-device fixture visible",
            ],
            directBrowserGatewayCalls: "none",
          });
        } finally {
          await context.close();
        }
      }

      await writeRealE2EScenarioEvidence(
        stack,
        "settings-ui-variants",
        {
          scenarioId: "settings-ui-variants",
          runId: fixture.runId,
          status: "passed",
          fixture,
          variants: variantEvidence,
          skippedSafe: ["access-token rotation", "device token rotate/revoke/remove"],
        },
        testInfo,
      );
    } finally {
      await restoreSettingsFixture(request, stack, fixture);
    }
  });
});

async function createSettingsFixture(
  request: APIRequestContext,
  stack: E2EStack,
  label: string,
  testInfo: TestInfo,
): Promise<SettingsFixtureAttempt> {
  const runId = stack.realE2E?.runId ?? buildRunScopedName("deckgo-e2e", "settings");
  const headers = authHeaders(stack.accessToken);
  const before = await expectOkJson(
    await request.get(`${stack.backendBase}/api/settings`, { headers }),
    "settings fixture before",
  );
  const originalSettings = asRecord(before.settings, "settings fixture before.settings");
  const originalPairedDevices = Array.isArray(originalSettings.pairedDevices)
    ? originalSettings.pairedDevices
    : [];
  const fixtureDevice = {
    id: buildRunScopedName(runId, `${label}-device`),
    name: buildRunScopedName(runId, `${label}-local-device`),
    ip: "127.0.0.1",
    platform: "real-e2e",
    version: "deck-go-real-e2e",
    metadata: { deckGoE2ERunId: runId },
  };
  assertRunScopedCleanupTarget(fixtureDevice, runId);
  const nextPairedDevices = [
    ...originalPairedDevices.filter((entry) => !containsRunId(entry, runId)),
    fixtureDevice,
  ];
  const put = await request.put(`${stack.backendBase}/api/settings`, {
    headers,
    data: { pairedDevices: nextPairedDevices },
  });
  if (!put.ok()) {
    const body = await put.text();
    const skipped = {
      status: "skipped-safe" as const,
      method: "PUT /api/settings pairedDevices",
      runId,
      reason: `settings fixture save failed ${put.status()}: ${body.slice(0, 500)}`,
    };
    await writeRealE2EScenarioEvidence(
      stack,
      "settings-fixture-attempt",
      {
        ...skipped,
        scenarioId: "settings-fixture-attempt",
        status: "handoff-blocked",
        fixtureAttemptStatus: skipped.status,
      },
      testInfo,
    );
    return skipped;
  }
  const attempt = {
    status: "attempted" as const,
    method: "PUT /api/settings pairedDevices",
    runId,
    fixtureDevice,
    originalPairedDevices,
  };
  await writeRealE2EScenarioEvidence(
    stack,
    "settings-fixture-attempt",
    {
      ...attempt,
      scenarioId: "settings-fixture-attempt",
      status: "passed",
      fixtureAttemptStatus: attempt.status,
    },
    testInfo,
  );
  return attempt;
}

async function restoreSettingsFixture(
  request: APIRequestContext,
  stack: E2EStack,
  fixture: SettingsFixtureAttempt,
) {
  if (fixture.status !== "attempted") {
    return;
  }
  const headers = authHeaders(stack.accessToken);
  const current = await expectOkJson(
    await request.get(`${stack.backendBase}/api/settings`, { headers }),
    "settings fixture cleanup read",
  );
  const settings = asRecord(current.settings, "settings fixture cleanup settings");
  const pairedDevices = Array.isArray(settings.pairedDevices) ? settings.pairedDevices : [];
  for (const device of pairedDevices.filter((entry) => containsRunId(entry, fixture.runId))) {
    assertRunScopedCleanupTarget(device, fixture.runId);
  }
  await request.put(`${stack.backendBase}/api/settings`, {
    headers,
    data: { pairedDevices: fixture.originalPairedDevices ?? [] },
  });
}

async function expectOkJson(
  response: { json: () => Promise<unknown>; ok: () => boolean; status: () => number },
  label: string,
) {
  expect(response.ok(), `${label} returned ${response.status()}`).toBe(true);
  const payload = await response.json();
  expect(payload).toBeTruthy();
  expect(typeof payload).toBe("object");
  return payload as JsonObject;
}

async function expectOkOrDegraded(
  request: APIRequestContext,
  stack: E2EStack,
  label: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  data: JsonObject | undefined,
  degradedStatuses: number[],
): Promise<RouteEvidence> {
  const response = await request.fetch(`${stack.backendBase}${path}`, {
    data,
    headers: authHeaders(stack.accessToken),
    method,
  });
  const status = response.status();
  const body = await response.text();
  const payload = parseJsonObject(body);
  if (!response.ok()) {
    expect(degradedStatuses, `${label} degraded with ${status}`).toContain(status);
    return { body: body.slice(0, 2000), label, ok: false, payload, status };
  }
  return { body: body.slice(0, 2000), label, ok: true, payload, status };
}

function asRecord(value: unknown, label: string): JsonObject {
  expect(value, `${label} should be present`).toBeTruthy();
  expect(typeof value, `${label} should be an object`).toBe("object");
  expect(Array.isArray(value), `${label} should not be an array`).toBe(false);
  return value as JsonObject;
}

function parseJsonObject(text: string): JsonObject {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : { raw: parsed };
  } catch {
    return { raw: text };
  }
}

function findRunScopedLocalDevice(settings: JsonObject, runId: string) {
  const pairedDevices = Array.isArray(settings.pairedDevices) ? settings.pairedDevices : [];
  return pairedDevices.find((device) => containsRunId(device, runId));
}

function containsRunId(value: unknown, runId: string): boolean {
  if (typeof value === "string") {
    return value.includes(runId);
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsRunId(entry, runId));
  }
  if (value && typeof value === "object") {
    return Object.values(value as JsonObject).some((entry) => containsRunId(entry, runId));
  }
  return false;
}

function recordDirectGateway(page: Page, stack: E2EStack) {
  const requests: string[] = [];
  const websockets: string[] = [];
  const prefixes = directGatewayPrefixes(stack);
  page.on("request", (request) => {
    if (prefixes.some((prefix) => request.url().startsWith(prefix))) {
      requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    if (prefixes.some((prefix) => websocket.url().startsWith(prefix))) {
      websockets.push(websocket.url());
    }
  });
  return { requests, websockets };
}

function directGatewayPrefixes(stack: E2EStack) {
  if (!stack.realGateway?.url) {
    return [];
  }
  const url = new URL(stack.realGateway.url);
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  return [url.origin, `${wsProtocol}//${url.host}`];
}

function recordUnexpected(page: Page, backendBase: string) {
  const unexpected: string[] = [];
  const degraded = ["/api/devices", "/api/devices/self", "/api/runtime/endpoint:test"];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      unexpected.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (!url.startsWith(`${backendBase}/api/`) || status < 400) {
      return;
    }
    if (degraded.some((path) => url.includes(path)) && [400, 404, 501, 502, 503].includes(status)) {
      return;
    }
    unexpected.push(`response: ${status} ${url}`);
  });
  return unexpected;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
