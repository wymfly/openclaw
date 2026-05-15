import { expect, test, type Page } from "@playwright/test";
import { openDeck, startLocalStack, type E2EStack } from "./helpers";

type Variant = {
  audit: string;
  auditUnsupported: string;
  cancel: string;
  close: string;
  editPermissions: string;
  killRun: string;
  lineage: string;
  lineageRoot: string;
  navLabel: string;
  outcome: string;
  outcomeRunning: string;
  permissions: string;
  raw: string;
  ready: string;
  runs: string;
  sendHint: string;
  steer: string;
  steerInstruction: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  title: string;
};

const VARIANTS: Variant[] = [
  {
    audit: "Audit",
    auditUnsupported: "No Subagents audit endpoint is currently declared.",
    cancel: "Cancel",
    close: "Close",
    editPermissions: "Edit permissions",
    killRun: "Kill run",
    lineage: "Lineage",
    lineageRoot: "Lineage root",
    navLabel: "Subagents",
    outcome: "Outcome",
    outcomeRunning: "Run is still in progress.",
    permissions: "Per-agent permissions",
    raw: "Raw",
    ready: "Subagents ready",
    runs: "Runs",
    sendHint: "Send hint",
    steer: "Steer",
    steerInstruction: "Steer instruction",
    theme: "dark",
    locale: "en",
    title: "Subagents",
  },
  {
    audit: "审计",
    auditUnsupported: "当前未声明 Subagents 审计端点。",
    cancel: "取消",
    close: "关闭",
    editPermissions: "编辑权限",
    killRun: "终止运行",
    lineage: "谱系",
    lineageRoot: "谱系根节点",
    navLabel: "子智能体",
    outcome: "结果",
    outcomeRunning: "运行仍在进行中。",
    permissions: "每智能体权限",
    raw: "原始",
    ready: "子智能体就绪",
    runs: "运行记录",
    sendHint: "发送提示",
    steer: "Steer",
    steerInstruction: "Steer 指令",
    theme: "dark",
    locale: "zh",
    title: "子智能体",
  },
  {
    audit: "Audit",
    auditUnsupported: "No Subagents audit endpoint is currently declared.",
    cancel: "Cancel",
    close: "Close",
    editPermissions: "Edit permissions",
    killRun: "Kill run",
    lineage: "Lineage",
    lineageRoot: "Lineage root",
    navLabel: "Subagents",
    outcome: "Outcome",
    outcomeRunning: "Run is still in progress.",
    permissions: "Per-agent permissions",
    raw: "Raw",
    ready: "Subagents ready",
    runs: "Runs",
    sendHint: "Send hint",
    steer: "Steer",
    steerInstruction: "Steer instruction",
    theme: "light",
    locale: "en",
    title: "Subagents",
  },
  {
    audit: "审计",
    auditUnsupported: "当前未声明 Subagents 审计端点。",
    cancel: "取消",
    close: "关闭",
    editPermissions: "编辑权限",
    killRun: "终止运行",
    lineage: "谱系",
    lineageRoot: "谱系根节点",
    navLabel: "子智能体",
    outcome: "结果",
    outcomeRunning: "运行仍在进行中。",
    permissions: "每智能体权限",
    raw: "原始",
    ready: "子智能体就绪",
    runs: "运行记录",
    sendHint: "发送提示",
    steer: "Steer",
    steerInstruction: "Steer 指令",
    theme: "light",
    locale: "zh",
    title: "子智能体",
  },
];

test.describe("subagents mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders dense subagents workbench variants and dialogs with contract-shaped mock data", async ({
    browser,
  }, testInfo) => {
    for (const variant of VARIANTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = collectUnexpectedErrors(page);
      const directGateway = collectDirectGateway(page, stack.mockGateway?.url);

      try {
        await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        const subagentsNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await subagentsNav.scrollIntoViewIfNeeded();
        await subagentsNav.click();

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
          "data-active-panel",
          "subagents",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("subagents-panel");
        await expect(panel).toBeVisible();
        await expect(
          panel.getByRole("heading", { exact: true, name: variant.title }),
        ).toBeVisible();
        await expect(panel.getByText(variant.ready)).toBeVisible();
        await expect(panel.getByText("14").first()).toBeVisible();
        await expect(panel.getByText("Executor").first()).toBeVisible();
        await expect(panel.locator(".row-list .row")).toHaveCount(14);
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);

        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath(
            variant.theme === "dark" && variant.locale === "en"
              ? "subagents-workbench-ready.png"
              : `subagents-workbench-${variant.theme}-${variant.locale}.png`,
          ),
        });

        if (variant.theme === "dark" && variant.locale === "en") {
          await panel.locator(".row").filter({ hasText: "Architect" }).first().click();
          await expect(
            panel.getByRole("heading", { exact: true, name: "Architect" }),
          ).toBeVisible();

          await panel.getByRole("tab", { name: variant.lineage }).click();
          await expect(panel.getByText(variant.lineageRoot)).toBeVisible();
          await expect(panel.getByText("run_bb7401").first()).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("subagents-lineage.png"),
          });

          await panel.getByRole("tab", { name: variant.outcome }).click();
          await expect(panel.getByText(variant.outcomeRunning)).toBeVisible();

          await panel.getByRole("tab", { name: variant.audit }).click();
          await expect(panel.getByText(variant.auditUnsupported)).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("subagents-audit-degraded.png"),
          });

          await panel.getByRole("button", { name: variant.raw }).click();
          const rawDialog = page.getByRole("dialog", { name: variant.raw });
          await expect(rawDialog).toBeVisible();
          await rawDialog.getByRole("button", { exact: true, name: variant.close }).click();

          await panel.getByRole("tab", { name: variant.permissions }).click();
          await panel.getByRole("button", { name: variant.editPermissions }).first().click();
          const permissionsDialog = page.getByRole("dialog", { name: variant.editPermissions });
          await expect(permissionsDialog).toBeVisible();
          await permissionsDialog
            .getByRole("button", { exact: true, name: variant.cancel })
            .click();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("subagents-permissions.png"),
          });

          await panel.getByRole("button", { name: variant.steer }).click();
          await page.getByLabel(variant.steerInstruction).fill("Keep this mock run focused");
          await page.getByRole("button", { name: variant.sendHint }).click();
          await expect(panel.getByText("Last subagent action")).toBeVisible();

          await panel.getByRole("button", { name: variant.killRun }).click();
          await expect(page.getByRole("dialog", { name: variant.killRun })).toBeVisible();
          await page.getByRole("button", { name: variant.cancel }).click();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("subagents-steer-kill-gated.png"),
          });

          await panel.getByRole("tab", { name: variant.runs }).click();
          await panel.getByRole("tab", { name: variant.permissions }).click();
          await expect(panel.getByText("Global spawn defaults")).toBeVisible();
        }

        expect(unexpected).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
});

function collectUnexpectedErrors(page: Page) {
  const unexpected: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (message.text().startsWith("Failed to load resource:")) {
        return;
      }
      unexpected.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400 && response.url().includes("/api/")) {
      unexpected.push(`response: ${status} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.push(`pageerror: ${error.message}`);
  });
  return unexpected;
}

function collectDirectGateway(page: Page, gatewayBase: string | undefined) {
  const directGateway = { requests: [] as string[], websockets: [] as string[] };
  if (!gatewayBase) {
    return directGateway;
  }
  page.on("request", (request) => {
    if (request.url().startsWith(gatewayBase)) {
      directGateway.requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    if (websocket.url().startsWith(gatewayBase)) {
      directGateway.websockets.push(websocket.url());
    }
  });
  return directGateway;
}
