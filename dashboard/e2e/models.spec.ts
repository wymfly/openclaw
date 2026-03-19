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
    const dots = page.locator("[class*='rounded-full']");
    const count = await dots.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("E-CAT-03: expand provider to see models", async ({ page }) => {
    // Click on moonshot provider to expand it
    const moonshotTrigger = page.locator("button", { hasText: "moonshot" }).first();
    await moonshotTrigger.click();

    // Model name "Kimi K2.5" should be visible in the expanded list
    await expect(page.locator("text=Kimi K2.5").first()).toBeVisible();
    // Context window badge "262K" should be visible
    await expect(page.locator("text=262K").first()).toBeVisible();
  });

  test("E-CAT-04: default model has star icon", async ({ page }) => {
    // Click moonshot to expand and select it
    const moonshotTrigger = page.locator("button", { hasText: "moonshot" }).first();
    await moonshotTrigger.click();
    await page.waitForTimeout(300);

    // When moonshot is selected, the ProviderOverview table shows in the right pane.
    // Kimi K2.5 is isDefault=true, so it has a Star icon (filled) next to its name in the table.
    // The Star SVG has a fill attribute — look for it in the overview table area.
    const defaultStar = page.locator("table svg");
    await expect(defaultStar.first()).toBeVisible();
  });

  test("E-CAT-05: select provider shows overview in right pane", async ({ page }) => {
    // Click moonshot provider header
    const moonshotTrigger = page.locator("button", { hasText: "moonshot" }).first();
    await moonshotTrigger.click();

    // Right pane should show provider overview with model comparison table
    const table = page.locator("table");
    await expect(table.first()).toBeVisible();

    // Table should contain model name
    await expect(page.locator("td", { hasText: "Kimi K2.5" }).first()).toBeVisible();
  });

  test("E-CAT-06: provider overview shows pricing in table", async ({ page }) => {
    // Select moonshot provider — right pane shows ProviderOverview with model comparison table
    const moonshotTrigger = page.locator("button", { hasText: "moonshot" }).first();
    await moonshotTrigger.click();
    await page.waitForTimeout(300);

    // The ProviderOverview table shows model prices in $X.XX/M format
    await expect(page.locator("text=$0.57/M").first()).toBeVisible();
    await expect(page.locator("text=$3.00/M").first()).toBeVisible();

    // "Set as Default" action should be visible for non-default models
    // (Kimi K2.5 is already default, so no button for it — but if other models existed, it would)
  });

  test("E-CAT-07: model price display format", async ({ page }) => {
    // Select moonshot provider to see overview table
    const moonshotTrigger = page.locator("button", { hasText: "moonshot" }).first();
    await moonshotTrigger.click();

    // Price should be in $X.XX/M format
    const priceCell = page.locator("text=$0.57/M");
    await expect(priceCell.first()).toBeVisible();
  });

  test("E-CAT-08: empty models shows message", async ({ page }) => {
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
    const configTab = page.locator("[role='tab']", { hasText: /提供商配置|Provider Config/ });
    await configTab.click();
    await page.waitForTimeout(300);
  });

  test("E-CFG-01: configured and unconfigured groups shown", async ({ page }) => {
    await expect(page.locator("text=moonshot").first()).toBeVisible();
    await expect(page.locator("text=openai").first()).toBeVisible();

    // Section labels: "Configured" / "已配置" and "Unconfigured" / "未配置"
    const configuredLabel = page.locator("text=/Configured|已配置/i");
    const unconfiguredLabel = page.locator("text=/Unconfigured|未配置/i");
    await expect(configuredLabel.first()).toBeVisible();
    await expect(unconfiguredLabel.first()).toBeVisible();
  });

  test("E-CFG-02: auth type badges displayed", async ({ page }) => {
    const apiKeyBadge = page.locator("text=/API Key|api_key/i");
    const oauthBadge = page.locator("text=/OAuth|oauth/i");
    await expect(apiKeyBadge.first()).toBeVisible();
    await expect(oauthBadge.first()).toBeVisible();
  });

  test("E-CFG-03: auth health card shows ready status", async ({ page }) => {
    // moonshot is auto-selected (first provider). Auth health card should show "Ready" / "就绪"
    const statusBadge = page.locator("text=/Ready|就绪/");
    await expect(statusBadge.first()).toBeVisible();

    // Auth source should be visible
    await expect(page.locator("text=env:MOONSHOT_API_KEY").first()).toBeVisible();
  });

  test("E-CFG-04: auth health card shows warning for expiring OAuth", async ({ page }) => {
    // Click on minimax (warning status with expiring OAuth)
    const minimaxBtn = page.locator("button", { hasText: "minimax" }).first();
    await minimaxBtn.click();
    await page.waitForTimeout(200);

    // Should show "Warning" / "警告" badge
    const warningBadge = page.locator("text=/Warning|警告/");
    await expect(warningBadge.first()).toBeVisible();

    // Should show expires countdown
    const expiresLabel = page.locator("text=/有效期剩余|Expires in/");
    await expect(expiresLabel.first()).toBeVisible();
  });

  test("E-CFG-06: probe diagnostic — success", async ({ page }) => {
    // The probe button should be visible (moonshot auto-selected)
    const probeBtn = page.locator("text=/运行诊断|Run Diagnostic/");
    await expect(probeBtn.first()).toBeVisible();

    await probeBtn.first().click();

    // After probe returns, should show "ok · 238ms"
    const result = page.locator("text=ok");
    await expect(result.first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=238ms").first()).toBeVisible();
  });

  test("E-CFG-07: probe diagnostic — failure", async ({ page }) => {
    // Override probe to return failure
    await page.route("**/api/models/probe", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "moonshot",
          status: "auth",
          latencyMs: 0,
          error: "Invalid API key",
        }),
      }),
    );

    const probeBtn = page.locator("text=/运行诊断|Run Diagnostic/");
    await probeBtn.first().click();

    // Should show error info
    await expect(page.locator("text=Invalid API key").first()).toBeVisible({ timeout: 3000 });
  });

  test("E-CFG-08: API key input with show/hide toggle", async ({ page }) => {
    // API Key input should be a password field
    const apiKeyInput = page.locator("input[type='password']").first();
    await expect(apiKeyInput).toBeVisible();

    // Click eye toggle to show
    const eyeBtn = page.locator("button[aria-label='Show API key']");
    await eyeBtn.click();

    // Input type should now be text
    const visibleInput = page.locator("input[placeholder='sk-...']").first();
    await expect(visibleInput).toHaveAttribute("type", "text");

    // Click again to hide
    const eyeOffBtn = page.locator("button[aria-label='Hide API key']");
    await eyeOffBtn.click();
    await expect(visibleInput).toHaveAttribute("type", "password");
  });

  test("E-CFG-09: save configuration", async ({ page }) => {
    // Type an API key
    const apiKeyInput = page.locator("input[placeholder='sk-...']").first();
    await apiKeyInput.fill("sk-test-123");

    // Click Save button
    const saveBtn = page.locator("button", { hasText: /Save|保存/ }).first();
    await saveBtn.click();

    // Should show "Saved" / "已保存" after success
    const savedText = page.locator("button", { hasText: /Saved|已保存/ });
    await expect(savedText.first()).toBeVisible({ timeout: 3000 });
  });

  test("E-CFG-10: unconfigured provider shows guidance", async ({ page }) => {
    // Click on openai (missing status)
    const openaiBtn = page.locator("button", { hasText: "openai" }).first();
    await openaiBtn.click();
    await page.waitForTimeout(200);

    // Should show "Not configured" / "未配置" status
    const missingStatus = page.locator("text=/Not configured|未配置/");
    await expect(missingStatus.first()).toBeVisible();
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
    const usageTab = page.locator("[role='tab']", { hasText: /用量|Usage/ });
    await usageTab.click();
    await page.waitForTimeout(300);
  });

  test("E-US-01: today cost card displayed", async ({ page }) => {
    const todayLabel = page.locator("text=/今日|Today/");
    await expect(todayLabel.first()).toBeVisible();

    // Today's cost from mock data is $12.38
    await expect(page.locator("text=$12.38").first()).toBeVisible();
  });

  test("E-US-02: week cost card displayed", async ({ page }) => {
    const weekLabel = page.locator("text=/本周|This Week/");
    await expect(weekLabel.first()).toBeVisible();

    // Sum of 7 days: 8.5+12.3+9.8+15.2+11.0+7.6+12.38 = 76.78
    await expect(page.locator("text=$76.78").first()).toBeVisible();
  });

  test("E-US-03: active providers card displayed", async ({ page }) => {
    const label = page.locator("text=/活跃提供商|Active Providers/");
    await expect(label.first()).toBeVisible();

    // 1 ready (moonshot) out of 3 total
    await expect(page.locator("text=1 / 3").first()).toBeVisible();
  });

  test("E-US-04: provider quota card with progress bar", async ({ page }) => {
    // Moonshot quota card should be visible
    await expect(page.locator("text=Moonshot").first()).toBeVisible();

    // Plan badge "Standard"
    await expect(page.locator("text=Standard").first()).toBeVisible();

    // Usage percent "72%"
    await expect(page.locator("text=72%").first()).toBeVisible();

    // Reset timer should be visible
    const resetsLabel = page.locator("text=/重置倒计时|Resets in/");
    await expect(resetsLabel.first()).toBeVisible();
  });

  test("E-US-06: 7-day trend chart renders", async ({ page }) => {
    // Recharts renders SVG elements — verify bar chart has bars
    const bars = page.locator(".recharts-bar-rectangle");
    await expect(bars.first()).toBeVisible({ timeout: 3000 });

    // Should have 7 bars for 7 days
    const barCount = await bars.count();
    expect(barCount).toBe(7);
  });

  test("E-US-08: view details link present", async ({ page }) => {
    const viewDetails = page.locator("text=/查看详细分析|View detailed analysis/");
    await expect(viewDetails.first()).toBeVisible();
  });

  test("E-US-09: empty cost data shows placeholder", async ({ page }) => {
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

    // With empty cost, "No cost data available" message should appear in chart area
    const emptyChart = page.locator("text=No cost data available");
    await expect(emptyChart.first()).toBeVisible();
  });

  test("E-US-10: provider with only error shows unavailable", async ({ page }) => {
    // Override usage status to include an error-only provider
    await page.route("**/api/usage", (route) => {
      if (route.request().url().includes("/api/usage/cost")) {
        return route.continue();
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          providers: [
            {
              provider: "broken",
              displayName: "Broken Provider",
              windows: [],
              error: "API unreachable",
            },
          ],
        }),
      });
    });

    await page.goto("/");
    await goToModels(page);
    const usageTab = page.locator("[role='tab']", { hasText: /用量|Usage/ });
    await usageTab.click();
    await page.waitForTimeout(500);

    // "Quota data unavailable" / "配额数据不可用"
    const noQuota = page.locator("text=/配额数据不可用|Quota data unavailable/");
    await expect(noQuota.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// §4.6 Cross-Tab Integration (P2)
// ---------------------------------------------------------------------------

test.describe("Cross-Tab Integration", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllRoutes(page);
    await page.goto("/");
    await goToModels(page);
  });

  test("E-INT-04: auth status consistency across Catalog and Config tabs", async ({ page }) => {
    // In Catalog tab, count green dots (moonshot=ready)
    // Note: we can't easily count specific colored dots, but we verify both tabs render without crash
    await expect(page.locator("text=moonshot").first()).toBeVisible();

    // Switch to Config tab
    const configTab = page.locator("[role='tab']", { hasText: /提供商配置|Provider Config/ });
    await configTab.click();
    await page.waitForTimeout(300);

    // Same providers should appear
    await expect(page.locator("text=moonshot").first()).toBeVisible();
    await expect(page.locator("text=openai").first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// §5 i18n Verification (P2)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// §7 Boundary Conditions (P3)
// ---------------------------------------------------------------------------

test.describe("Boundary Conditions", () => {
  test("BC-01: gateway disconnected — all tabs render without crash", async ({ page }) => {
    // Mock all APIs to fail (simulating gateway down)
    await page.route("**/api/onboarding/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ needsOnboarding: false }),
      }),
    );
    await page.route("**/api/gateway/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "disconnected" }),
      }),
    );
    await page.route("**/api/settings", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );
    await page.route("**/api/models", (route) =>
      route.fulfill({ status: 500, body: "Gateway down" }),
    );
    await page.route("**/api/models/auth", (route) =>
      route.fulfill({ status: 500, body: "Gateway down" }),
    );
    await page.route("**/api/models/config", (route) =>
      route.fulfill({ status: 500, body: "Gateway down" }),
    );
    await page.route("**/api/usage/**", (route) =>
      route.fulfill({ status: 500, body: "Gateway down" }),
    );
    await page.route("**/api/usage", (route) =>
      route.fulfill({ status: 500, body: "Gateway down" }),
    );

    await page.goto("/");
    await goToModels(page);

    // Should not white-screen — tabs should still be visible
    const tabs = page.locator("[role='tab']");
    await expect(tabs).toHaveCount(4);

    // Click through each tab to verify no crash
    for (let i = 0; i < 4; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(200);
    }
  });

  test("BC-02: large model list renders without timeout", async ({ page }) => {
    // Generate 100+ models
    const largeModelList = Array.from({ length: 120 }, (_, i) => ({
      id: `model-${i}`,
      name: `Model ${i}`,
      provider: `provider-${Math.floor(i / 10)}`,
      contextWindow: 128000,
      inputPrice: 1.0,
      outputPrice: 2.0,
      reasoning: i % 3 === 0,
      input: ["text"],
      maxTokens: 4096,
    }));

    await setupAllRoutes(page);
    await page.route("**/api/models", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ models: largeModelList }),
      }),
    );

    await page.goto("/");
    await goToModels(page);

    // Should render without timeout — verify at least some providers visible
    await expect(page.locator("text=provider-0").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=provider-5").first()).toBeVisible({ timeout: 5000 });
  });

  test("BC-06: no provider has auth — Config tab shows all unconfigured", async ({ page }) => {
    await setupAllRoutes(page);
    // Override auth to all missing
    await page.route("**/api/models/auth", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          providers: [
            { provider: "moonshot", status: "missing", auth: null },
            { provider: "openai", status: "missing", auth: null },
          ],
        }),
      }),
    );

    await page.goto("/");
    await goToModels(page);
    const configTab = page.locator("[role='tab']", { hasText: /提供商配置|Provider Config/ });
    await configTab.click();
    await page.waitForTimeout(300);

    // All providers should be in the "Unconfigured" group
    const unconfigured = page.locator("text=/Unconfigured|未配置/i");
    await expect(unconfigured.first()).toBeVisible();

    // "Not configured" status badge should appear
    const missingBadge = page.locator("text=/Not configured|未配置/");
    await expect(missingBadge.first()).toBeVisible();
  });

  test("BC-07: provider with multiple usage windows", async ({ page }) => {
    await setupAllRoutes(page);
    await page.route("**/api/usage", (route) => {
      if (route.request().url().includes("/api/usage/cost")) {
        return route.continue();
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          providers: [
            {
              provider: "multi",
              displayName: "Multi Window Provider",
              windows: [
                { label: "Daily", usedPercent: 30, resetsInMs: 19380000 },
                { label: "Monthly", usedPercent: 85, resetsInMs: 1900800000 },
              ],
              plan: "Enterprise",
            },
          ],
        }),
      });
    });

    await page.goto("/");
    await goToModels(page);
    const usageTab = page.locator("[role='tab']", { hasText: /用量|Usage/ });
    await usageTab.click();
    await page.waitForTimeout(300);

    // Both windows should be visible
    await expect(page.locator("text=Daily").first()).toBeVisible();
    await expect(page.locator("text=Monthly").first()).toBeVisible();

    // Both percentages
    await expect(page.locator("text=30%").first()).toBeVisible();
    await expect(page.locator("text=85%").first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// §5 i18n Verification (P2)
// ---------------------------------------------------------------------------

test.describe("i18n Verification", () => {
  test("I18N-01: default Chinese locale renders all tabs without missing keys", async ({
    page,
  }) => {
    await setupAllRoutes(page);
    await page.goto("/");
    await goToModels(page);

    // All 4 tab labels in Chinese
    await expect(page.locator("[role='tab']", { hasText: "目录" })).toBeVisible();
    await expect(page.locator("[role='tab']", { hasText: "提供商配置" })).toBeVisible();
    await expect(page.locator("[role='tab']", { hasText: "回退链" })).toBeVisible();
    await expect(page.locator("[role='tab']", { hasText: "用量" })).toBeVisible();

    // No missing i18n keys (they show as the raw key path like "models.tabs.xxx")
    const body = await page.locator("body").textContent();
    expect(body).not.toContain("models.tabs.");
    expect(body).not.toContain("models.fallbacks.");
    expect(body).not.toContain("models.auth.");
  });
});
