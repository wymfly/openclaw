import http from "node:http";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { authHeaders, openDeck, startBundledStack, type E2EStack } from "./helpers";

type Variant = {
  addWebhook: string;
  cancel: string;
  deliveries: string;
  deleteWebhook: string;
  editWebhook: string;
  navLabel: string;
  ready: RegExp;
  searchPlaceholder: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  title: string;
};

const VARIANTS: Variant[] = [
  {
    addWebhook: "New Webhook",
    cancel: "Cancel",
    deliveries: "Deliveries",
    deleteWebhook: "Delete Webhook",
    editWebhook: "Edit Webhook",
    navLabel: "Webhooks",
    ready: /Webhooks ready/,
    searchPlaceholder: "name, url, id, or event",
    theme: "dark",
    locale: "en",
    title: "Webhooks",
  },
  {
    addWebhook: "新建 Webhook",
    cancel: "取消",
    deliveries: "投递",
    deleteWebhook: "删除 Webhook",
    editWebhook: "编辑 Webhook",
    navLabel: "Webhooks",
    ready: /Webhooks.*就绪/,
    searchPlaceholder: "名称、URL、ID 或事件",
    theme: "dark",
    locale: "zh",
    title: "Webhook",
  },
  {
    addWebhook: "New Webhook",
    cancel: "Cancel",
    deliveries: "Deliveries",
    deleteWebhook: "Delete Webhook",
    editWebhook: "Edit Webhook",
    navLabel: "Webhooks",
    ready: /Webhooks ready/,
    searchPlaceholder: "name, url, id, or event",
    theme: "light",
    locale: "en",
    title: "Webhooks",
  },
  {
    addWebhook: "新建 Webhook",
    cancel: "取消",
    deliveries: "投递",
    deleteWebhook: "删除 Webhook",
    editWebhook: "编辑 Webhook",
    navLabel: "Webhooks",
    ready: /Webhooks.*就绪/,
    searchPlaceholder: "名称、URL、ID 或事件",
    theme: "light",
    locale: "zh",
    title: "Webhook",
  },
];

test.describe("webhooks mock visual handoff alignment", () => {
  let stack: E2EStack;
  let receiver: Awaited<ReturnType<typeof startReceiver>>;

  test.beforeAll(async ({ request }, testInfo) => {
    receiver = await startReceiver();
    stack = await startBundledStack(testInfo);
    await seedWebhooks(request, stack, receiver.url);
  });

  test.afterAll(async () => {
    await stack?.stop();
    await receiver?.stop();
  });

  test("renders receiver workbench variants with local BFF-backed delivery states", async ({
    browser,
  }, testInfo) => {
    for (const variant of VARIANTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = collectUnexpectedErrors(page);

      try {
        await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        const webhooksNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await webhooksNav.scrollIntoViewIfNeeded();
        await webhooksNav.click();

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
          "data-active-panel",
          "webhooks",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("webhooks-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("heading", { name: variant.title }).first()).toBeVisible();
        await expect(panel.getByText(variant.ready).first()).toBeVisible();
        await expect(panel.getByText("Security incident receiver").first()).toBeVisible();
        await expect(panel.getByText("Usage limit receiver").first()).toBeVisible();
        await expect(panel.getByText("Internal QA bridge").first()).toBeVisible();
        await expect(panel.locator(".webhooks-panel__list > li")).toHaveCount(6);
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);

        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath(
            variant.theme === "dark" && variant.locale === "en"
              ? "webhooks-workbench-ready.png"
              : `webhooks-workbench-${variant.theme}-${variant.locale}.png`,
          ),
        });

        if (variant.theme === "dark" && variant.locale === "en") {
          await panel.getByPlaceholder(variant.searchPlaceholder).fill("usage");
          await expect(panel.locator(".webhooks-panel__list > li")).toHaveCount(1);
          await panel.getByRole("button", { name: /Usage limit receiver/ }).click();
          await expect(panel.getByText("https://hooks.example.test/usage").first()).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("webhooks-filter-selected.png"),
          });

          await panel.getByPlaceholder(variant.searchPlaceholder).fill("");
          await panel.getByRole("button", { name: /Security incident receiver/ }).click();
          await panel.getByRole("button", { name: variant.editWebhook }).click();
          await expect(page.getByRole("dialog").getByLabel("webhook name")).toHaveValue(
            "Security incident receiver",
          );
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("webhooks-edit-escape.png"),
          });

          await panel.getByRole("button", { name: "Test Delivery" }).click();
          await expect(panel.getByText("Last webhook action").first()).toBeVisible();
          await expect
            .poll(() => receiver.requests.length, { timeout: 10_000 })
            .toBeGreaterThanOrEqual(2);
          await panel.getByRole("button", { name: variant.deliveries }).click();
          await panel
            .getByRole("button", { name: /test\.ping/ })
            .first()
            .click();
          await expect(panel.getByText("Payload").first()).toBeVisible();
          await expect(panel.getByText("Response body").first()).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("webhooks-test-delivery-result.png"),
          });

          await panel.getByRole("button", { name: variant.deleteWebhook }).click();
          await expect(page.getByRole("dialog")).toContainText("Delete this webhook?");
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);

          await panel.getByRole("button", { name: variant.addWebhook }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: variant.cancel })
            .first()
            .click();
          await expect(page.getByRole("dialog")).toHaveCount(0);
        }

        expect(unexpected).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
});

async function seedWebhooks(request: APIRequestContext, stack: E2EStack, receiverUrl: string) {
  const created: Array<{ id: string }> = [];
  for (const body of [
    {
      enabled: true,
      events: ["alert.fired", "approval.pending"],
      name: "Security incident receiver",
      secret: "visual-secret",
      url: receiverUrl,
    },
    {
      enabled: false,
      events: ["usage.limit", "budget.over"],
      name: "Usage limit receiver",
      url: "https://hooks.example.test/usage",
    },
    {
      enabled: true,
      events: ["alert.fired"],
      name: "PagerDuty critical",
      secret: "pd-secret",
      url: receiverUrl,
    },
    {
      enabled: true,
      events: ["deploy.started", "deploy.finished"],
      name: "GitHub deploy sync",
      secret: "gh-secret",
      url: "https://api.github.com/repos/openclaw/deck/dispatches",
    },
    {
      enabled: true,
      events: ["session.created", "session.closed", "memory.added"],
      name: "Internal QA bridge",
      secret: "qa-secret",
      url: "https://qa.internal.example.com/hooks/deck-events",
    },
    {
      enabled: false,
      events: ["channel.message"],
      name: "Old relay disabled",
      url: "https://legacy.example.com/relay",
    },
  ]) {
    created.push(await createWebhook(request, stack, body));
  }
  const security = created[0];
  const testResponse = await request.post(`${stack.backendBase}/api/webhooks/${security.id}/test`, {
    headers: authHeaders(stack.accessToken),
  });
  expect(testResponse.ok(), `webhook test seed returned ${testResponse.status()}`).toBe(true);
}

async function createWebhook(
  request: APIRequestContext,
  stack: E2EStack,
  body: {
    enabled: boolean;
    events: string[];
    name: string;
    secret?: string;
    url: string;
  },
) {
  const response = await request.post(`${stack.backendBase}/api/webhooks`, {
    data: body,
    headers: authHeaders(stack.accessToken),
  });
  expect(response.ok(), `webhook seed returned ${response.status()}`).toBe(true);
  return (await response.json()) as { id: string };
}

async function startReceiver() {
  const requests: string[] = [];
  const server = http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    requests.push(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("receiver did not bind to a TCP port");
  }
  return {
    requests,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
    url: `http://127.0.0.1:${address.port}/webhook`,
  };
}

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
