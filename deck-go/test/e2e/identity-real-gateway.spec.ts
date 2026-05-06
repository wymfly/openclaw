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

type IdentityPeer = {
  channel?: string;
  peerId?: string;
};

type IdentityLink = {
  canonical?: string;
  peers?: IdentityPeer[];
};

type IdentityListPayload = {
  configHash?: string;
  links?: IdentityLink[];
};

type IdentityFixture = {
  baseHash: string;
  canonical: string;
  channel: string;
  cleanupStatus?: number;
  created: boolean;
  peerId: string;
  reason?: string;
  unlinkHash: string;
};

const IDENTITY_REAL_VARIANTS = [
  {
    bffOnly: "BFF only",
    cancelLabel: "Cancel",
    dialogTitle: "Link Identity",
    linkPeerLabel: "Link peer",
    locale: "en" as const,
    navLabel: "Identities",
    newLabel: "New",
    rawPayload: "Identity payload",
    renameLabel: "Rename",
    searchLabel: "Search canonicals",
    theme: "dark" as const,
    title: "Identities",
    unsupported:
      "Create, rename, delete, activity, and audit workflows are not in the current Identity contract.",
  },
  {
    bffOnly: "仅 BFF",
    cancelLabel: "取消",
    dialogTitle: "关联身份",
    linkPeerLabel: "关联 peer",
    locale: "zh" as const,
    navLabel: "身份",
    newLabel: "新建",
    rawPayload: "身份载荷",
    renameLabel: "重命名",
    searchLabel: "搜索统一身份",
    theme: "dark" as const,
    title: "身份",
    unsupported: "新建、重命名、删除、activity、审计工作流不在当前 Identity 契约中。",
  },
  {
    bffOnly: "BFF only",
    cancelLabel: "Cancel",
    dialogTitle: "Link Identity",
    linkPeerLabel: "Link peer",
    locale: "en" as const,
    navLabel: "Identities",
    newLabel: "New",
    rawPayload: "Identity payload",
    renameLabel: "Rename",
    searchLabel: "Search canonicals",
    theme: "light" as const,
    title: "Identities",
    unsupported:
      "Create, rename, delete, activity, and audit workflows are not in the current Identity contract.",
  },
  {
    bffOnly: "仅 BFF",
    cancelLabel: "取消",
    dialogTitle: "关联身份",
    linkPeerLabel: "关联 peer",
    locale: "zh" as const,
    navLabel: "身份",
    newLabel: "新建",
    rawPayload: "身份载荷",
    renameLabel: "重命名",
    searchLabel: "搜索统一身份",
    theme: "light" as const,
    title: "身份",
    unsupported: "新建、重命名、删除、activity、审计工作流不在当前 Identity 契约中。",
  },
];

test.describe("identity real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Identity real Gateway E2E",
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

  test("verifies Identity route shapes, safe fixture attempt, UI variants, and cleanup", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId =
      stack.realE2E?.runId ?? `deckgo-e2e-identity-w${testInfo.workerIndex}-r${testInfo.retry}`;
    const routeEvidence: JsonObject = { runId };
    const uiEvidence: JsonObject[] = [];
    let initialLinks: IdentityLink[] = [];
    let fixture: IdentityFixture | null = null;

    try {
      const runtime = await expectOkJson(
        await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers }),
        "/runtime/gateway",
      );
      routeEvidence.runtime = pickKeys(runtime, ["mode", "status", "health", "configured", "pid"]);

      const listResponse = await request.get(`${stack.backendBase}/api/deck/identity`, {
        headers,
      });
      routeEvidence.listStatus = listResponse.status();
      if (listResponse.ok()) {
        const listPayload = assertIdentityListPayload(await listResponse.json());
        initialLinks = listPayload.links ?? [];
        routeEvidence.list = {
          configHash: listPayload.configHash ?? null,
          links: initialLinks.length,
          peers: initialLinks.reduce((total, link) => total + (link.peers?.length ?? 0), 0),
        };
        fixture = await createIdentityFixture(request, stack, runId, listPayload.configHash);
        routeEvidence.fixture = fixture
          ? {
              canonical: fixture.canonical,
              channel: fixture.channel,
              cleanupStatus: fixture.cleanupStatus ?? null,
              created: fixture.created,
              peerId: fixture.peerId,
              reason: fixture.reason ?? null,
            }
          : {
              reason: "identity list did not expose a configHash",
              status: "skipped-safe",
            };
      } else {
        routeEvidence.listDegraded = {
          body: await listResponse.text(),
          status: listResponse.status(),
        };
        expect([400, 404, 501, 502, 503]).toContain(listResponse.status());
      }

      const unsupported = await request.post(`${stack.backendBase}/api/deck/identity`, {
        data: {
          action: "create",
          canonical: buildRunScopedName(runId, "unsupported"),
          baseHash: "x",
        },
        headers,
      });
      routeEvidence.unsupportedCreate = {
        body: await unsupported.text(),
        status: unsupported.status(),
      };
      expect([400, 404, 409, 422, 501, 502, 503]).toContain(unsupported.status());

      const agentIdentity = await request.get(`${stack.backendBase}/api/agents/main/identity`, {
        headers,
      });
      routeEvidence.agentIdentityStatus = agentIdentity.status();
      if (agentIdentity.ok()) {
        const agentPayload = await jsonShape(agentIdentity);
        routeEvidence.agentIdentity = pickKeys(agentPayload, ["agentId", "name", "emoji"]);
        expect(typeof agentPayload.agentId).toBe("string");
      } else {
        routeEvidence.agentIdentityDegraded = await agentIdentity.text();
        expect([400, 404, 501, 502, 503]).toContain(agentIdentity.status());
      }

      const targetCanonical =
        (fixture?.created ? fixture.canonical : null) ??
        initialLinks.find((link) => typeof link.canonical === "string")?.canonical ??
        null;
      const targetPeer = fixture?.created
        ? { channel: fixture.channel, peerId: fixture.peerId }
        : initialLinks
            .flatMap((link) =>
              (link.peers ?? []).map((peer) => ({ canonical: link.canonical, ...peer })),
            )
            .find((peer) => typeof peer.peerId === "string");

      for (const variant of IDENTITY_REAL_VARIANTS) {
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

          const identityNav = page
            .locator(".deck-ui-rail")
            .getByRole("button", { exact: true, name: variant.navLabel });
          await identityNav.scrollIntoViewIfNeeded();
          await identityNav.click();
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
            "data-active-panel",
            "identity",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("identity-panel");
          await expect(panel).toBeVisible();
          await expect(panel.getByRole("heading", { name: variant.title }).first()).toBeVisible();
          await expect(panel.getByText(variant.bffOnly).first()).toBeVisible();
          await expect
            .poll(async () => {
              const ready = await panel.getByText(/Mutation safety|变更安全/).count();
              const empty = await panel
                .getByText(/No identity links configured|未配置身份关联/)
                .count();
              const degraded = await panel.getByText(/identity|Gateway|failed|身份|失败/i).count();
              return ready + empty + degraded;
            })
            .toBeGreaterThan(0);

          const searched = Boolean(targetCanonical);
          if (targetCanonical) {
            await panel.getByLabel(variant.searchLabel).fill(targetCanonical);
            await expect(panel.getByText(targetCanonical).first()).toBeVisible();
            await panel
              .getByRole("tab", { name: new RegExp(escapeRegExp(targetCanonical)) })
              .click();
            if (targetPeer?.peerId) {
              await expect(panel.getByText(targetPeer.peerId).first()).toBeVisible();
            }

            await panel.getByText(variant.rawPayload).click();
            await expect(panel.locator(".identity-panel__raw pre").first()).toBeVisible();
          } else {
            await expect(
              panel
                .getByText(
                  /No identity links configured|未配置身份关联|identity links fetch failed|身份关联加载失败|Gateway|failed|失败/i,
                )
                .first(),
            ).toBeVisible();
          }

          await panel.getByRole("button", { name: variant.newLabel }).click();
          await expect(panel.getByText(variant.unsupported).first()).toBeVisible();
          if (targetCanonical) {
            await panel.getByRole("button", { name: variant.renameLabel }).click();
            await expect(panel.getByText(variant.unsupported).first()).toBeVisible();

            await panel.getByRole("button", { name: variant.linkPeerLabel }).click();
            await expect(page.getByRole("dialog", { name: variant.dialogTitle })).toBeVisible();
            await page
              .getByRole("dialog")
              .locator(".identity-panel__dialog-actions")
              .getByRole("button", { name: variant.cancelLabel })
              .click();
          }

          await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
          expect(unexpected.consoleErrors).toEqual([]);
          expect(unexpected.pageErrors).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);

          uiEvidence.push({
            directGateway,
            fixture: fixture?.created ? fixture.canonical : null,
            locale: variant.locale,
            navigation: "chat-to-identity",
            searched,
            theme: variant.theme,
            unexpected,
          });
        } finally {
          await context.close();
        }
      }
    } finally {
      routeEvidence.cleanup = await cleanupIdentityFixture(request, stack, runId, fixture);
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "identity-real-product-surface",
      {
        cleanup: routeEvidence.cleanup,
        routeEvidence,
        runId,
        scenarioId: "identity.real.product-surface",
        status: fixture?.created ? "passed" : "degraded",
        uiEvidence,
      },
      testInfo,
    );
  });
});

async function createIdentityFixture(
  request: APIRequestContext,
  stack: E2EStack,
  runId: string,
  baseHash?: string,
): Promise<IdentityFixture | null> {
  if (!baseHash) {
    return null;
  }
  const headers = authHeaders(stack.accessToken);
  const canonical = buildRunScopedName(runId, "identity-canonical");
  const channel = "deck-go-e2e";
  const peerId = buildRunScopedName(runId, "identity-peer");
  const linkResponse = await request.post(`${stack.backendBase}/api/deck/identity`, {
    data: { action: "link", baseHash, canonical, channel, peerId },
    headers,
  });
  if (!linkResponse.ok()) {
    expect([400, 404, 409, 422, 501, 502, 503]).toContain(linkResponse.status());
    return {
      baseHash,
      canonical,
      channel,
      created: false,
      peerId,
      unlinkHash: baseHash,
    };
  }

  const linkPayload = await jsonShape(linkResponse);
  const unlinkHash = typeof linkPayload.configHash === "string" ? linkPayload.configHash : baseHash;
  const verify = await request.get(`${stack.backendBase}/api/deck/identity`, { headers });
  expect(verify.ok(), `identity verify list returned ${verify.status()}`).toBe(true);
  const verifyPayload = assertIdentityListPayload(await verify.json());
  if (!isRunScopedValue(verifyPayload, runId)) {
    const cleanup = await request.post(`${stack.backendBase}/api/deck/identity`, {
      data: { action: "unlink", baseHash: unlinkHash, canonical, channel, peerId },
      headers,
    });
    return {
      baseHash,
      canonical,
      channel,
      cleanupStatus: cleanup.status(),
      created: false,
      peerId,
      reason: "link returned ok, but follow-up list did not expose the run-scoped fixture",
      unlinkHash,
    };
  }
  return {
    baseHash,
    canonical,
    channel,
    created: true,
    peerId,
    unlinkHash,
  };
}

async function cleanupIdentityFixture(
  request: APIRequestContext,
  stack: E2EStack,
  runId: string,
  fixture: IdentityFixture | null,
) {
  if (!fixture?.created) {
    return { status: "skipped-safe", reason: "no run-scoped identity fixture was created" };
  }
  if (!fixture.canonical.includes(runId) || !fixture.peerId.includes(runId)) {
    return {
      canonical: fixture.canonical,
      peerId: fixture.peerId,
      status: "refused",
      reason: "cleanup target was not run-scoped",
    };
  }
  const headers = authHeaders(stack.accessToken);
  const response = await request.post(`${stack.backendBase}/api/deck/identity`, {
    data: {
      action: "unlink",
      baseHash: fixture.unlinkHash,
      canonical: fixture.canonical,
      channel: fixture.channel,
      peerId: fixture.peerId,
    },
    headers,
  });
  return {
    canonical: fixture.canonical,
    peerId: fixture.peerId,
    status: response.status(),
    text: await response.text(),
  };
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

async function jsonShape(response: { json: () => Promise<unknown> }) {
  const payload = await response.json();
  expect(payload).toBeTruthy();
  expect(typeof payload).toBe("object");
  expect(Array.isArray(payload)).toBe(false);
  return payload as JsonObject;
}

function assertIdentityListPayload(payload: unknown): IdentityListPayload {
  expect(payload).toBeTruthy();
  expect(typeof payload).toBe("object");
  expect(Array.isArray(payload)).toBe(false);
  const shaped = payload as IdentityListPayload;
  expect(Array.isArray(shaped.links)).toBe(true);
  for (const link of shaped.links ?? []) {
    expect(typeof link.canonical).toBe("string");
    expect(Array.isArray(link.peers)).toBe(true);
    for (const peer of link.peers ?? []) {
      expect(typeof peer.channel).toBe("string");
      expect(typeof peer.peerId).toBe("string");
    }
  }
  return shaped;
}

function pickKeys(value: JsonObject, keys: string[]) {
  const picked: JsonObject = {};
  for (const key of keys) {
    if (key in value) {
      picked[key] = value[key];
    }
  }
  return picked;
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
    if (!url.startsWith(`${backendBase}/api/`) || status < 400) {
      return;
    }
    if (
      (url.includes("/api/deck/identity") || url.includes("/api/agents/main/identity")) &&
      [400, 404, 409, 422, 501, 502, 503].includes(status)
    ) {
      return;
    }
    unexpected.apiErrors.push(`response: ${status} ${url}`);
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
