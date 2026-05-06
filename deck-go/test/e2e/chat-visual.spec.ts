import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

type ChatVisualVariant = {
  artifactLabel: string;
  canvasLabel: string;
  emptyTitle: string;
  filterThinking: string;
  locale: "en" | "zh";
  navLabel: string;
  placeholder: string;
  searchTranscript: string;
  theme: "dark" | "light";
};

const CHAT_VISUAL_VARIANTS: ChatVisualVariant[] = [
  {
    artifactLabel: "Artifact panel",
    canvasLabel: "Canvas panel",
    emptyTitle: "Start a conversation",
    filterThinking: "Thinking",
    locale: "en",
    navLabel: "Chat",
    placeholder: "Type a message...",
    searchTranscript: "Search messages...",
    theme: "dark",
  },
  {
    artifactLabel: "工件面板",
    canvasLabel: "画布面板",
    emptyTitle: "开始新对话",
    filterThinking: "推理",
    locale: "zh",
    navLabel: "对话",
    placeholder: "输入消息...",
    searchTranscript: "搜索对话...",
    theme: "dark",
  },
  {
    artifactLabel: "Artifact panel",
    canvasLabel: "Canvas panel",
    emptyTitle: "Start a conversation",
    filterThinking: "Thinking",
    locale: "en",
    navLabel: "Chat",
    placeholder: "Type a message...",
    searchTranscript: "Search messages...",
    theme: "light",
  },
  {
    artifactLabel: "工件面板",
    canvasLabel: "画布面板",
    emptyTitle: "开始新对话",
    filterThinking: "推理",
    locale: "zh",
    navLabel: "对话",
    placeholder: "输入消息...",
    searchTranscript: "搜索对话...",
    theme: "light",
  },
];

test.describe("chat visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders chat-rich variants as a console-clean Deck workbench", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    for (const variant of CHAT_VISUAL_VARIANTS) {
      await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
        deckVisualState: "chat-rich",
        locale: variant.locale,
        nav: "expanded",
        theme: variant.theme,
      });

      await expect(page.getByLabel("Chat workspace")).toBeVisible();
      await expect(page.locator(".ds-chat-shell")).toBeVisible();
      await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "chat");
      await expect(
        page.locator(".deck-ui-rail").getByRole("button", { name: variant.navLabel }),
      ).toHaveClass(/is-active/);
      await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);
      await page.waitForTimeout(500);

      const metrics = await page.evaluate(() => {
        const rect = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) {
            return null;
          }
          const box = element.getBoundingClientRect();
          return {
            height: Math.round(box.height),
            width: Math.round(box.width),
            x: Math.round(box.x),
            y: Math.round(box.y),
          };
        };
        return {
          chat: rect(".ds-chat-shell"),
          content: rect(".deck-ui-content"),
          contentClass: document.querySelector(".deck-ui-content")?.className ?? "",
          nestedButtons: document.querySelectorAll("button button").length,
        };
      });

      expect(metrics.contentClass).toContain("deck-ui-content--workbench");
      expect(metrics.nestedButtons).toBe(0);
      expect(metrics.chat).not.toBeNull();
      expect(metrics.content).not.toBeNull();
      expect(metrics.chat?.x).toBe(metrics.content?.x);
      expect(metrics.chat?.y).toBe(metrics.content?.y);
      expect(metrics.chat?.width).toBe(metrics.content?.width);
      expect(metrics.chat?.height).toBe(metrics.content?.height);

      await expect(page.locator("textarea")).toHaveAttribute("placeholder", variant.placeholder);
      await expect(page.getByRole("button", { name: variant.canvasLabel })).toBeVisible();
      await expect(page.getByRole("button", { name: variant.artifactLabel })).toBeVisible();
      await expect(page.locator('[data-right-panel-mode="canvas"]')).toBeVisible();
      await expect(
        page.locator(".ds-block-filter-bar").getByText(variant.filterThinking),
      ).toBeVisible();

      await page.screenshot({
        fullPage: false,
        path: testInfo.outputPath(
          variant.theme === "dark" && variant.locale === "en"
            ? "chat-rich-workbench.png"
            : `chat-rich-${variant.theme}-${variant.locale}.png`,
        ),
      });

      await page.locator(".ds-chat-context-bar__search-btn").click();
      await expect(page.getByPlaceholder(variant.searchTranscript)).toBeVisible();
      await page.getByPlaceholder(variant.searchTranscript).fill("Gateway");
      await expect(page.locator(".ds-transcript-search__count")).toBeVisible();
    }

    expect(unexpected).toEqual([]);
  });

  test("renders chat-empty in localized light mode", async ({ page }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
      deckVisualState: "chat-empty",
      locale: "zh",
      nav: "expanded",
      theme: "light",
    });

    await expect(page.getByLabel("Chat workspace")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByText("开始新对话")).toBeVisible();
    await expect(page.locator("textarea")).toHaveAttribute("placeholder", "输入消息...");

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("chat-empty-light-zh.png"),
    });

    expect(unexpected).toEqual([]);
  });

  test("supports keyboard walkthrough across composer, tools, approvals, artifact, and canvas", async ({
    page,
  }) => {
    const unexpected = collectUnexpectedErrors(page);

    await openRichChat(page, stack);

    await tabUntil(page, ".ds-session-sidebar__new");
    await page.keyboard.press("Enter");
    await expect(page.locator("textarea")).toBeVisible();

    await tabUntil(page, "textarea");
    await page.keyboard.type("Keyboard walkthrough smoke");
    await expect(page.locator("textarea")).toHaveValue("Keyboard walkthrough smoke");

    await tabUntil(page, ".deck-ui-composer-send");
    await page.keyboard.press("Enter");
    await expect(page.locator("textarea")).toHaveValue("");

    await openRichChat(page, stack);

    const activeToolTab = page.getByRole("tab", { name: "read" });
    await activeToolTab.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Show Raw" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await expectKeyboardFocusable(page, page.getByRole("button", { exact: true, name: "Approve" }));
    await expectKeyboardFocusable(page, page.getByRole("button", { name: "Deny" }));

    await page.getByRole("button", { name: "Collapse canvas" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-right-panel-mode="canvas"]')).toHaveCount(0);

    await page.locator(".ds-artifact-card button").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-right-panel-mode="artifact"]')).toBeVisible();

    await expectKeyboardFocusable(page, page.getByRole("tab", { name: "JSON" }));
    await page.getByRole("button", { exact: true, name: "Close" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-right-panel-mode="artifact"]')).toHaveCount(0);

    await page.getByRole("button", { name: "Canvas panel" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-right-panel-mode="canvas"]')).toBeVisible();

    await page.getByRole("button", { name: "Collapse canvas" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-right-panel-mode="canvas"]')).toHaveCount(0);

    expect(unexpected).toEqual([]);
  });
});

async function openRichChat(page: Page, stack: E2EStack) {
  await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
    deckVisualState: "chat-rich",
    locale: "en",
    nav: "expanded",
    theme: "dark",
  });
  await expect(page.getByLabel("Chat workspace")).toBeVisible();
  await page.waitForTimeout(500);
}

async function tabUntil(page: Page, selector: string, maxTabs = 120) {
  for (let index = 0; index < maxTabs; index += 1) {
    if (await page.evaluate((current) => document.activeElement?.matches(current), selector)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Could not reach ${selector} with Tab`);
}

async function expectKeyboardFocusable(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.focus();
  await expect(locator).toBeFocused();
  const hasFocusableElement = await page.evaluate(() => document.activeElement !== document.body);
  expect(hasFocusableElement).toBe(true);
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
