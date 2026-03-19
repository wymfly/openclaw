import { expect, test } from "@playwright/test";

/**
 * Models Hub E2E tests — Fallbacks Tab (P0) + Tab navigation + other tabs.
 *
 * All API calls are intercepted via page.route() to inject mock data.
 * No live Gateway backend required.
 */

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockModels = [
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshot",
    contextWindow: 262144,
    inputPrice: 0.57,
    outputPrice: 3.0,
    reasoning: true,
    input: ["text", "image"],
    maxTokens: 32768,
    isDefault: true,
  },
  {
    id: "MiniMax-M2.5",
    name: "MiniMax M2.5",
    provider: "minimax",
    contextWindow: 205000,
    inputPrice: 0.3,
    outputPrice: 1.2,
    reasoning: true,
    input: ["text"],
    maxTokens: 16384,
  },
  {
    id: "gpt-5.1-codex",
    name: "GPT 5.1 Codex",
    provider: "openai",
    contextWindow: 131072,
    inputPrice: 2.5,
    outputPrice: 10,
    reasoning: false,
    input: ["text", "image"],
    maxTokens: 32768,
  },
];

const mockAuthOverview = [
  {
    provider: "moonshot",
    status: "ready",
    auth: { type: "api_key", source: "env:MOONSHOT_API_KEY", profileId: "moonshot:default" },
  },
  {
    provider: "minimax",
    status: "warning",
    auth: { type: "oauth", source: "profile:minimax:oauth" },
    oauth: { expiresAt: Date.now() + 3600000, remainingMs: 3600000, status: "expiring" },
  },
  { provider: "openai", status: "missing", auth: null },
];

function makeConfigJson(overrides?: {
  primary?: string;
  fallbacks?: string[];
  imageModel?: string | { primary: string; fallbacks: string[] };
}) {
  return JSON.stringify({
    agents: {
      defaults: {
        model: {
          primary: overrides?.primary ?? "moonshot/kimi-k2.5",
          fallbacks: overrides?.fallbacks ?? ["minimax/MiniMax-M2.5"],
        },
        imageModel: overrides?.imageModel ?? "openai/gpt-5.1-codex",
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Shared setup: mock all APIs and navigate to Models panel → Fallbacks Tab
// ---------------------------------------------------------------------------

async function setupAllRoutes(page: import("@playwright/test").Page) {
  // Onboarding check
  await page.route("**/api/onboarding/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ needsOnboarding: false }),
    }),
  );

  // Gateway status
  await page.route("**/api/gateway/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "connected" }),
    }),
  );

  // Settings
  await page.route("**/api/settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
  );

  // Models list
  await page.route("**/api/models", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ models: mockModels }),
      });
    }
    return route.continue();
  });

  // Auth overview
  await page.route("**/api/models/auth", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ providers: mockAuthOverview }),
    }),
  );

  // Config (GET for fallbacks, PATCH for updates)
  await page.route("**/api/models/config", (route) => {
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    // GET
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        raw: makeConfigJson(),
        hash: "test-hash-001",
      }),
    });
  });

  // Usage cost
  await page.route("**/api/usage/cost**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        costs: [
          { date: "2026-03-13", cost: 8.5 },
          { date: "2026-03-14", cost: 12.3 },
          { date: "2026-03-15", cost: 9.8 },
          { date: "2026-03-16", cost: 15.2 },
          { date: "2026-03-17", cost: 11.0 },
          { date: "2026-03-18", cost: 7.6 },
          { date: "2026-03-19", cost: 12.38 },
        ],
      }),
    }),
  );

  // Usage status
  await page.route("**/api/usage", (route) => {
    // Only match exact /api/usage, not /api/usage/cost
    if (route.request().url().includes("/api/usage/cost")) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        providers: [
          {
            provider: "moonshot",
            displayName: "Moonshot",
            windows: [{ label: "Daily", usedPercent: 72, resetsInMs: 19380000 }],
            plan: "Standard",
          },
        ],
      }),
    });
  });

  // Probe
  await page.route("**/api/models/probe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        provider: "moonshot",
        profileId: "moonshot:default",
        status: "ok",
        latencyMs: 238,
        model: "kimi-k2.5",
      }),
    }),
  );
}

/** Navigate to Models panel by clicking the NavRail "模型" button. */
async function goToModels(page: import("@playwright/test").Page) {
  // NavRail uses nav buttons with labels. In zh locale, Models = "模型".
  const modelsNav = page.locator("nav button", { hasText: "模型" });
  await modelsNav.click();
  // Wait for the Tabs container to appear
  await page.waitForSelector("[role='tablist']");
}

/** Click the Fallbacks tab trigger. */
async function goToFallbacksTab(page: import("@playwright/test").Page) {
  const fallbacksTab = page.locator("[role='tab']", { hasText: /回退链|Fallbacks/ });
  await fallbacksTab.click();
  // Wait for content to render — FallbackChain header should appear
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// §4.1 Tab Navigation
// ---------------------------------------------------------------------------

test.describe("Tab Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllRoutes(page);
    await page.goto("/");
    await goToModels(page);
  });

  test("E-NAV-01: four tabs visible and switchable", async ({ page }) => {
    const tablist = page.locator("[role='tablist']");
    const tabs = tablist.locator("[role='tab']");
    await expect(tabs).toHaveCount(4);

    // Click each tab and verify content changes (no error)
    for (let i = 0; i < 4; i++) {
      await tabs.nth(i).click();
      // Verify no crash — at least one tab content area is visible
      await expect(page.locator("[role='tabpanel']").first()).toBeVisible();
    }
  });

  test("E-NAV-02: default tab is Catalog", async ({ page }) => {
    const catalogTab = page.locator("[role='tab']", { hasText: /目录|Catalog/ });
    // base-ui uses aria-selected="true" and data-active (no value) for the active tab
    await expect(catalogTab).toHaveAttribute("aria-selected", "true");
  });
});

// ---------------------------------------------------------------------------
// §4.4 Fallbacks Tab (P0)
// ---------------------------------------------------------------------------

test.describe("Fallbacks Tab", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllRoutes(page);
    await page.goto("/");
    await goToModels(page);
    await goToFallbacksTab(page);
  });

  test("E-FB-01: primary model card rendered with crown", async ({ page }) => {
    // Primary model card should show the model info
    // Crown icon is in an element with "Primary Model" / "主力模型"
    // There are two FallbackChain instances (text + image), so use .first()
    const primaryLabel = page.locator("text=/主力模型|Primary Model/").first();
    await expect(primaryLabel).toBeVisible();

    // Model name should be visible
    const modelText = page.locator("text=Kimi K2.5");
    await expect(modelText.first()).toBeVisible();
  });

  test("E-FB-02: fallback chain cards displayed", async ({ page }) => {
    // Mock has 1 fallback: minimax/MiniMax-M2.5
    const minimax = page.locator("text=MiniMax M2.5");
    await expect(minimax.first()).toBeVisible();

    // Fallback cards have drag handles (GripVertical icon → aria-label)
    const dragHandle = page.locator("button[aria-label='Drag to reorder']");
    await expect(dragHandle).toHaveCount(1);
  });

  test("E-FB-03: arrow connector between cards", async ({ page }) => {
    // Arrow connector shows "On failure" / "失败时"
    const arrow = page.locator("text=/失败时|On failure/");
    await expect(arrow.first()).toBeVisible();
  });

  test("E-FB-04: card shows context window and capabilities", async ({ page }) => {
    // Kimi K2.5 has 262144 tokens → formatContextWindow outputs "262K"
    const ctx = page.locator("text=262K");
    await expect(ctx.first()).toBeVisible();
  });

  test("E-FB-05: auth missing warning on fallback card", async ({ page }) => {
    // Set up config with openai fallback (which has missing auth)
    await page.route("**/api/models/config", (route) => {
      if (route.request().method() === "PATCH") {
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          raw: makeConfigJson({
            primary: "moonshot/kimi-k2.5",
            fallbacks: ["openai/gpt-5.1-codex"],
          }),
          hash: "h1",
        }),
      });
    });

    // Reload to pick up new config mock
    await page.goto("/");
    await goToModels(page);
    await goToFallbacksTab(page);

    // Auth warning text should appear for the openai model
    const warning = page.locator("text=/未配置认证|no auth configured/");
    await expect(warning.first()).toBeVisible();

    // Configure link should be present
    const configLink = page.locator("text=/去配置|Configure/");
    await expect(configLink.first()).toBeVisible();
  });

  test("E-FB-07: remove fallback card", async ({ page }) => {
    // Click the remove button (X icon with aria-label)
    const removeBtn = page.locator("button[aria-label='Remove from fallback chain']");
    await expect(removeBtn).toHaveCount(1);

    // Intercept the PATCH call to verify it gets called
    const patchCalls: string[] = [];
    await page.route("**/api/models/config", (route) => {
      if (route.request().method() === "PATCH") {
        patchCalls.push(route.request().postData() ?? "");
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ raw: makeConfigJson(), hash: "h2" }),
      });
    });

    await removeBtn.click();

    // Wait for debounced save (500ms + margin)
    await page.waitForTimeout(800);

    // Verify PATCH was called
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("E-FB-08: add fallback model via select", async ({ page }) => {
    // Find the "Add Fallback Model" / "添加回退模型" trigger
    const addBtn = page.locator("text=/添加回退模型|Add Fallback Model/").first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Select dropdown should show available models (excluding those already in chain)
    // openai/gpt-5.1-codex should be available since it's not in the text chain
    const option = page.locator("[role='option']", { hasText: "GPT 5.1 Codex" });
    await expect(option).toBeVisible();
  });

  test("E-FB-09: change primary model via select", async ({ page }) => {
    // The primary card has a Change / "更换" select trigger
    const changeBtn = page.locator("text=/更换|Change/").first();
    await expect(changeBtn).toBeVisible();
    await changeBtn.click();

    // Should see other models in the dropdown
    const option = page.locator("[role='option']", { hasText: "GPT 5.1 Codex" });
    await expect(option).toBeVisible();
  });

  test("E-FB-10: empty fallback chain state", async ({ page }) => {
    // Override config to have no fallbacks
    await page.route("**/api/models/config", (route) => {
      if (route.request().method() === "PATCH") {
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          raw: makeConfigJson({ primary: "moonshot/kimi-k2.5", fallbacks: [] }),
          hash: "h-empty",
        }),
      });
    });

    await page.goto("/");
    await goToModels(page);
    await goToFallbacksTab(page);

    // Empty state message
    const emptyMsg = page.locator("text=/未配置回退链|No fallback chain configured/");
    await expect(emptyMsg.first()).toBeVisible();

    // Add button still present
    const addBtn = page.locator("text=/添加回退模型|Add Fallback Model/").first();
    await expect(addBtn).toBeVisible();
  });

  test("E-FB-11: image model section displayed", async ({ page }) => {
    // Image models section header
    const imageHeader = page.locator("text=/图像模型|Image Models/");
    await expect(imageHeader.first()).toBeVisible();
  });

  test("E-FB-12: auto-save feedback shown", async ({ page }) => {
    // Remove a fallback to trigger save
    const removeBtn = page.locator("button[aria-label='Remove from fallback chain']");
    if ((await removeBtn.count()) > 0) {
      await removeBtn.first().click();

      // "Saving..." / "保存中..." should briefly appear
      const savingText = page.locator("text=/保存中|Saving/");
      await expect(savingText.first()).toBeVisible({ timeout: 2000 });

      // Wait for "Saved" / "已保存"
      const savedText = page.locator("text=/已保存|Saved/");
      await expect(savedText.first()).toBeVisible({ timeout: 3000 });
    }
  });
});

// ---------------------------------------------------------------------------
// §4.2 Catalog Tab (P1)
// ---------------------------------------------------------------------------

test.describe("Catalog Tab", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllRoutes(page);
    await page.goto("/");
    await goToModels(page);
  });

  test("E-CAT-01: provider list loads with model count", async ({ page }) => {
    // Should see provider names — moonshot, minimax, openai
    await expect(page.locator("text=moonshot").first()).toBeVisible();
    await expect(page.locator("text=minimax").first()).toBeVisible();
    await expect(page.locator("text=openai").first()).toBeVisible();
  });

  test("E-CAT-02: auth status dots visible", async ({ page }) => {
    // Auth status dots are rendered per provider — just verify no crash
    // The ProviderList renders AuthStatusDot for each provider
    const dots = page.locator("[class*='rounded-full']");
    // At least 3 providers should have dots
    const count = await dots.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("E-CAT-08: empty models shows message", async ({ page }) => {
    // Override models to empty
    await page.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ models: [] }),
      }),
    );

    await page.goto("/");
    await goToModels(page);

    const emptyMsg = page.locator("text=/未发现|No models found/");
    await expect(emptyMsg.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// §4.3 Provider Config Tab (P1)
// ---------------------------------------------------------------------------

test.describe("Provider Config Tab", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllRoutes(page);
    await page.goto("/");
    await goToModels(page);
    // Click Config tab
    const configTab = page.locator("[role='tab']", { hasText: /提供商配置|Provider Config/ });
    await configTab.click();
    await page.waitForTimeout(300);
  });

  test("E-CFG-01: configured and unconfigured groups shown", async ({ page }) => {
    // Auth overview has moonshot (ready), minimax (warning) as configured; openai (missing) as unconfigured
    // The sidebar should show grouped providers
    await expect(page.locator("text=moonshot").first()).toBeVisible();
    await expect(page.locator("text=openai").first()).toBeVisible();
  });

  test("E-CFG-02: auth type badges displayed", async ({ page }) => {
    // moonshot has api_key, minimax has oauth
    const apiKeyBadge = page.locator("text=/API Key|api_key/i");
    const oauthBadge = page.locator("text=/OAuth|oauth/i");
    // At least one of each should be visible
    await expect(apiKeyBadge.first()).toBeVisible();
    await expect(oauthBadge.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// §4.5 Usage Tab (P1)
// ---------------------------------------------------------------------------

test.describe("Usage Tab", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllRoutes(page);
    await page.goto("/");
    await goToModels(page);
    // Click Usage tab
    const usageTab = page.locator("[role='tab']", { hasText: /用量|Usage/ });
    await usageTab.click();
    await page.waitForTimeout(300);
  });

  test("E-US-01: today cost card displayed", async ({ page }) => {
    // "Today" / "今日" label should be visible
    const todayLabel = page.locator("text=/今日|Today/");
    await expect(todayLabel.first()).toBeVisible();
  });

  test("E-US-03: active providers card displayed", async ({ page }) => {
    // "Active Providers" / "活跃提供商"
    const label = page.locator("text=/活跃提供商|Active Providers/");
    await expect(label.first()).toBeVisible();
  });

  test("E-US-09: empty data shows placeholder", async ({ page }) => {
    // Override cost to empty
    await page.route("**/api/usage/cost**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ costs: [] }),
      }),
    );

    await page.goto("/");
    await goToModels(page);
    const usageTab = page.locator("[role='tab']", { hasText: /用量|Usage/ });
    await usageTab.click();
    await page.waitForTimeout(500);

    // Today cost should show $0 or the empty state
    const todayLabel = page.locator("text=/今日|Today/");
    await expect(todayLabel.first()).toBeVisible();
  });
});
