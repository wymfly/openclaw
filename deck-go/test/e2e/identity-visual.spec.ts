import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

const IDENTITY_VISUAL_VARIANTS = [
  {
    bffOnly: "BFF only",
    cancelLabel: "Cancel",
    canonicalCount: "5 canonicals",
    dialogTitle: "Link Identity",
    linkPeerLabel: "Link peer",
    locale: "en" as const,
    navLabel: "Identities",
    newLabel: "New",
    noPeers: "No peers linked to this canonical.",
    peerCount: "8 peers",
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
    canonicalCount: "5 个统一身份",
    dialogTitle: "关联身份",
    linkPeerLabel: "关联 peer",
    locale: "zh" as const,
    navLabel: "身份",
    newLabel: "新建",
    noPeers: "该统一身份暂无关联 peer。",
    peerCount: "8 个 peer",
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
    canonicalCount: "5 canonicals",
    dialogTitle: "Link Identity",
    linkPeerLabel: "Link peer",
    locale: "en" as const,
    navLabel: "Identities",
    newLabel: "New",
    noPeers: "No peers linked to this canonical.",
    peerCount: "8 peers",
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
    canonicalCount: "5 个统一身份",
    dialogTitle: "关联身份",
    linkPeerLabel: "关联 peer",
    locale: "zh" as const,
    navLabel: "身份",
    newLabel: "新建",
    noPeers: "该统一身份暂无关联 peer。",
    peerCount: "8 个 peer",
    rawPayload: "身份载荷",
    renameLabel: "重命名",
    searchLabel: "搜索统一身份",
    theme: "light" as const,
    title: "身份",
    unsupported: "新建、重命名、删除、activity、审计工作流不在当前 Identity 契约中。",
  },
];

test.describe("identity mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders identity relationship workbench, variants, and guarded mutation states", async ({
    browser,
  }, testInfo) => {
    for (const variant of IDENTITY_VISUAL_VARIANTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = collectUnexpectedErrors(page, stack);

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
        await waitForGatewayMethod(stack.requestLog, "deck.identity.list");
        await expect(panel.getByRole("heading", { name: variant.title }).first()).toBeVisible();
        await expect(panel.getByText(variant.bffOnly).first()).toBeVisible();
        await expect(panel.getByText(variant.canonicalCount).first()).toBeVisible();
        await expect(panel.getByText(variant.peerCount).first()).toBeVisible();
        await expect(panel.getByText("identity-hash-visual-1").first()).toBeVisible();
        await expect(panel.getByText(/Mutation safety|变更安全/).first()).toBeVisible();
        await expect(panel.getByText(/Recent mutations|最近变更/).first()).toBeVisible();
        await expect(panel.getByText("review-pool").first()).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);

        await panel.getByLabel(variant.searchLabel).fill("oncall");
        await expect(panel.getByText("ops-rotation").first()).toBeVisible();
        await panel.getByRole("tab", { name: /ops-rotation/ }).click();
        await expect(panel.getByText("tg-oncall-bot").first()).toBeVisible();
        await panel.getByLabel(variant.searchLabel).fill("");
        await panel.getByRole("tab", { name: /review-pool/ }).click();
        await expect(panel.getByText(variant.noPeers).first()).toBeVisible();

        await panel.getByText(variant.rawPayload).click();
        await expect(panel.getByText('"canonical": "review-pool"').first()).toBeVisible();

        await panel.getByRole("button", { name: variant.newLabel }).click();
        await expect(panel.getByText(variant.unsupported).first()).toBeVisible();
        await panel.getByRole("button", { name: variant.renameLabel }).click();
        await expect(panel.getByText(variant.unsupported).first()).toBeVisible();

        await panel.getByRole("button", { name: variant.linkPeerLabel }).click();
        await expect(page.getByRole("dialog", { name: variant.dialogTitle })).toBeVisible();
        await page
          .getByRole("dialog")
          .locator(".identity-panel__dialog-actions")
          .getByRole("button", { name: variant.cancelLabel })
          .click();

        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath(
            variant.locale === "en" && variant.theme === "dark"
              ? "identity-workbench-ready.png"
              : `identity-workbench-${variant.theme}-${variant.locale}.png`,
          ),
        });

        expect(unexpected.apiErrors).toEqual([]);
        expect(unexpected.consoleErrors).toEqual([]);
        expect(unexpected.pageErrors).toEqual([]);
        expect(unexpected.directGatewayRequests).toEqual([]);
        expect(unexpected.directGatewaySockets).toEqual([]);
      } finally {
        await context.close();
      }
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    const unexpected = collectUnexpectedErrors(page, stack);

    try {
      await openDeck(page, stack.frontendBase, "identity", stack.accessToken, {
        locale: "en",
        nav: "expanded",
        theme: "dark",
      });
      const panel = page.getByTestId("identity-panel");
      await expect(panel).toBeVisible();
      await panel.getByRole("button", { name: "Link peer" }).click();
      await expect(page.getByRole("dialog", { name: "Link Identity" })).toBeVisible();
      await page.getByLabel("identity canonical").fill(" reviewer ");
      await page.getByLabel("identity channel").fill(" telegram ");
      await page.getByLabel("identity peer id").fill(" tg-reviewer ");
      await page.screenshot({
        fullPage: false,
        path: testInfo.outputPath("identity-link-dialog.png"),
      });

      await Promise.all([
        page.waitForResponse((response) => {
          return (
            response.url().includes("/api/deck/identity") &&
            response.request().method() === "POST" &&
            response.ok()
          );
        }),
        page.getByRole("button", { name: "Save" }).click(),
      ]);
      await waitForGatewayMethod(stack.requestLog, "deck.identity.link");
      await expect(page.getByText("Linked telegram:tg-reviewer to reviewer.")).toBeVisible();
      await expect(page.getByText("identity-hash-visual-2").first()).toBeVisible();
      await expect(page.getByText("reviewer").first()).toBeVisible();
      await page.screenshot({
        fullPage: false,
        path: testInfo.outputPath("identity-linked-state.png"),
      });

      expect(unexpected.apiErrors).toEqual([]);
      expect(unexpected.consoleErrors).toEqual([]);
      expect(unexpected.pageErrors).toEqual([]);
      expect(unexpected.directGatewayRequests).toEqual([]);
      expect(unexpected.directGatewaySockets).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

function collectUnexpectedErrors(page: Page, stack: E2EStack) {
  const unexpected = {
    apiErrors: [] as string[],
    consoleErrors: [] as string[],
    directGatewayRequests: [] as string[],
    directGatewaySockets: [] as string[],
    pageErrors: [] as string[],
  };
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      unexpected.consoleErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("request", (request) => {
    if (stack.mockGateway?.url && request.url().startsWith(stack.mockGateway.url)) {
      unexpected.directGatewayRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400 && response.url().includes("/api/")) {
      unexpected.apiErrors.push(`response: ${status} ${response.url()}`);
    }
  });
  page.on("websocket", (websocket) => {
    const gatewayUrl = stack.mockGateway?.url;
    const gatewayWebsocketUrl = gatewayUrl?.replace(/^http/i, "ws");
    if (
      (gatewayUrl && websocket.url().startsWith(gatewayUrl)) ||
      (gatewayWebsocketUrl && websocket.url().startsWith(gatewayWebsocketUrl))
    ) {
      unexpected.directGatewaySockets.push(websocket.url());
    }
  });
  page.on("pageerror", (error) => {
    unexpected.pageErrors.push(`pageerror: ${error.message}`);
  });
  return unexpected;
}
