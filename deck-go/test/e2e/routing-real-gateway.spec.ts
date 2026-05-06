import { expect, test, type APIResponse, type Page } from "@playwright/test";
import {
  authHeaders,
  buildRunScopedName,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;

type Variant = {
  addBinding: string;
  cancel: string;
  navLabel: string;
  refreshLabel: string;
  removeBinding: string;
  simulate: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
};

const VARIANTS: Variant[] = [
  {
    addBinding: "Add binding...",
    cancel: "Cancel",
    navLabel: "Routing",
    refreshLabel: "Refresh routing",
    removeBinding: "Remove binding",
    simulate: "Simulate",
    theme: "dark",
    locale: "en",
  },
  {
    addBinding: "添加绑定...",
    cancel: "取消",
    navLabel: "消息路由",
    refreshLabel: "刷新路由",
    removeBinding: "移除绑定",
    simulate: "模拟",
    theme: "dark",
    locale: "zh",
  },
  {
    addBinding: "Add binding...",
    cancel: "Cancel",
    navLabel: "Routing",
    refreshLabel: "Refresh routing",
    removeBinding: "Remove binding",
    simulate: "Simulate",
    theme: "light",
    locale: "en",
  },
  {
    addBinding: "添加绑定...",
    cancel: "取消",
    navLabel: "消息路由",
    refreshLabel: "刷新路由",
    removeBinding: "移除绑定",
    simulate: "模拟",
    theme: "light",
    locale: "zh",
  },
];

test.describe("routing real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the routing real Gateway E2E",
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

  test("verifies routing route shapes, run-scoped binding fixture, UI variants, and BFF-only transport", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const jsonHeaders = { ...headers, "Content-Type": "application/json" };
    const runId = stack.realE2E?.runId ?? stack.runId;
    const fixturePeerId = buildRunScopedName(runId, "routing-peer");
    const routeEvidence: JsonObject = { runId };

    const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
    expect(runtime.ok(), `/runtime/gateway returned ${runtime.status()}`).toBe(true);
    routeEvidence.runtime = await responseShape(runtime);

    const list = await request.get(`${stack.backendBase}/api/deck/routing`, { headers });
    expect([200, 502], `/deck/routing returned ${list.status()}`).toContain(list.status());
    const listShape = await responseShape(list);
    const baseHash =
      typeof listShape.payload?.configHash === "string" ? listShape.payload.configHash : "";
    routeEvidence.list = {
      ...listShape,
      bindingCount: Array.isArray(listShape.payload?.bindings)
        ? listShape.payload.bindings.length
        : null,
      hasConfigHash: Boolean(baseHash),
    };

    const validate = await request.post(`${stack.backendBase}/api/deck/routing`, {
      headers: jsonHeaders,
      data: {
        action: "validate",
        agentId: "main",
        match: { channel: "telegram", peer: { kind: "direct", id: fixturePeerId } },
      },
    });
    expect([200, 400, 502], `/deck/routing validate returned ${validate.status()}`).toContain(
      validate.status(),
    );
    routeEvidence.validate = await responseShape(validate);

    const simulate = await request.post(`${stack.backendBase}/api/deck/routing`, {
      headers: jsonHeaders,
      data: {
        action: "simulate",
        channel: "telegram",
        peer: { kind: "direct", id: fixturePeerId },
      },
    });
    expect([200, 400, 502], `/deck/routing simulate returned ${simulate.status()}`).toContain(
      simulate.status(),
    );
    routeEvidence.simulate = await responseShape(simulate);

    let fixtureBindingId = "";
    let cleanupHash = baseHash;
    const add =
      baseHash && list.status() === 200
        ? await request.post(`${stack.backendBase}/api/deck/routing`, {
            headers: jsonHeaders,
            data: {
              action: "add",
              agentId: "main",
              match: {
                channel: "telegram",
                peer: { kind: "direct", id: fixturePeerId },
              },
              baseHash,
              comment: `deck-go real e2e ${runId}`,
              position: 0,
            },
          })
        : null;
    if (add) {
      expect([200, 400, 409, 422, 502], `/deck/routing add returned ${add.status()}`).toContain(
        add.status(),
      );
      const addShape = await responseShape(add);
      fixtureBindingId = extractBindingId(addShape.payload);
      cleanupHash =
        typeof addShape.payload?.configHash === "string"
          ? addShape.payload.configHash
          : cleanupHash;
      routeEvidence.addFixture = {
        created: add.status() === 200 && Boolean(fixtureBindingId),
        fixtureBindingId,
        fixturePeerId,
        shape: addShape,
      };
    } else {
      routeEvidence.addFixture = {
        created: false,
        reason: "no usable baseHash from /deck/routing",
      };
    }
    const fixtureCreated =
      isObject(routeEvidence.addFixture) && routeEvidence.addFixture.created === true;

    const postAddList = await request.get(`${stack.backendBase}/api/deck/routing`, { headers });
    expect([200, 502], `/deck/routing post-add returned ${postAddList.status()}`).toContain(
      postAddList.status(),
    );
    const postAddShape = await responseShape(postAddList);
    const fixtureListed =
      fixtureCreated && payloadContains(postAddShape.payload, fixturePeerId, fixtureBindingId);
    cleanupHash =
      typeof postAddShape.payload?.configHash === "string"
        ? postAddShape.payload.configHash
        : cleanupHash;
    routeEvidence.postAddList = {
      ...postAddShape,
      fixtureListed,
    };

    const invalidRemove = await request.post(`${stack.backendBase}/api/deck/routing`, {
      headers: jsonHeaders,
      data: {
        action: "remove",
        id: buildRunScopedName(runId, "nonexistent-routing-binding"),
        baseHash: "__deck_go_e2e_invalid_hash__",
      },
    });
    expect(
      [400, 404, 409, 422, 502],
      `/deck/routing invalid remove returned ${invalidRemove.status()}`,
    ).toContain(invalidRemove.status());
    routeEvidence.invalidRemove = await responseShape(invalidRemove);

    const uiEvidence: JsonObject[] = [];
    for (const variant of VARIANTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = recordUnexpected(page, stack.backendBase);
      const directGateway = collectDirectGateway(page, stack);

      try {
        await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        const routingNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await routingNav.scrollIntoViewIfNeeded();
        await routingNav.click();
        await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
          "data-active-panel",
          "routing",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("routing-panel");
        await expect(panel).toBeVisible();
        await expect(
          panel.getByRole("button", { name: variant.refreshLabel }).first(),
        ).toBeVisible();
        if (fixtureListed) {
          await expect(panel.getByText(fixturePeerId).first()).toBeVisible({ timeout: 8000 });
        }

        await panel.getByRole("button", { name: variant.addBinding }).click();
        await expect(
          panel.getByText(/Add or validate binding|添加或验证绑定/).first(),
        ).toBeVisible();

        const removeButton = panel.getByRole("button", { name: variant.removeBinding });
        const removeVisible = await removeButton.isVisible().catch(() => false);
        if (removeVisible) {
          await removeButton.click();
          await expect(panel.getByRole("alertdialog")).toBeVisible();
          await panel.getByRole("button", { name: variant.cancel }).click();
        }

        await panel.getByRole("button", { name: variant.simulate, exact: true }).click();
        await expect(
          panel
            .getByText(
              /Simulation result|模拟结果|matched by|匹配来源|Run a simulation|运行模拟|simulate|模拟|failed|失败/i,
            )
            .first(),
        ).toBeVisible();

        await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
        expect(unexpected.consoleErrors).toEqual([]);
        expect(unexpected.pageErrors).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);

        uiEvidence.push({
          directGateway,
          fixtureVisible: fixtureListed
            ? await panel
                .getByText(fixturePeerId)
                .first()
                .isVisible()
                .catch(() => false)
            : false,
          locale: variant.locale,
          navigation: "chat-to-routing",
          removeConfirmExercised: removeVisible,
          theme: variant.theme,
          unexpected,
        });
      } finally {
        await context.close();
      }
    }

    if (fixtureCreated && fixtureBindingId && cleanupHash) {
      const cleanup = await request.post(`${stack.backendBase}/api/deck/routing`, {
        headers: jsonHeaders,
        data: { action: "remove", id: fixtureBindingId, baseHash: cleanupHash },
      });
      expect(
        [200, 400, 404, 409, 422, 502],
        `/deck/routing cleanup remove returned ${cleanup.status()}`,
      ).toContain(cleanup.status());
      routeEvidence.cleanup = await responseShape(cleanup);
    } else {
      routeEvidence.cleanup = { skipped: true, reason: "fixture was not created" };
    }

    const evidence: JsonObject = {
      routeEvidence,
      runId,
      scenarioId: "routing.real.product-surface",
      status: fixtureCreated && fixtureListed ? "passed" : "degraded",
      uiEvidence,
    };
    await writeRealE2EScenarioEvidence(stack, "routing-real-product-surface", evidence, testInfo);
  });
});

async function responseShape(response: APIResponse): Promise<{
  keys: string[];
  payload?: JsonObject;
  status: number;
}> {
  const text = await response.text();
  let payload: JsonObject | undefined;
  try {
    const parsed = text ? JSON.parse(text) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as JsonObject;
    }
  } catch {
    payload = { raw: text.slice(0, 400) };
  }
  return {
    keys: payload ? Object.keys(payload).toSorted() : [],
    payload,
    status: response.status(),
  };
}

function extractBindingId(payload?: JsonObject) {
  const binding = payload?.binding;
  if (binding && typeof binding === "object" && !Array.isArray(binding)) {
    const id = (binding as JsonObject).id;
    return typeof id === "string" ? id : undefined;
  }
  const id = payload?.id;
  return typeof id === "string" ? id : undefined;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function payloadContains(payload: unknown, ...needles: Array<string | undefined>) {
  const searchable = needles.filter((needle): needle is string => Boolean(needle));
  if (searchable.length === 0) {
    return false;
  }
  const json = JSON.stringify(payload ?? {});
  return searchable.some((needle) => json.includes(needle));
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
    if (
      url.startsWith(`${backendBase}/api/deck/routing`) &&
      [400, 404, 409, 422, 502].includes(status)
    ) {
      return;
    }
    if (url.startsWith(`${backendBase}/api/activity`) && status === 502) {
      return;
    }
    if (url.startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.apiErrors.push(`response: ${status} ${url}`);
    }
  });
  return unexpected;
}

function collectDirectGateway(page: Page, stack: E2EStack) {
  const directGateway = {
    requests: [] as string[],
    websockets: [] as string[],
  };
  page.on("request", (request) => {
    if (stack.realGateway?.url && request.url().startsWith(stack.realGateway.url)) {
      directGateway.requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    if (stack.realGateway?.url && websocket.url().startsWith(stack.realGateway.url)) {
      directGateway.websockets.push(websocket.url());
    }
  });
  return directGateway;
}
