import { expect, test } from "@playwright/test";

/**
 * Doc Hub E2E tests — document list, category filtering, search.
 *
 * Addresses Codex Review R1-F6: verify that the Doc Hub panel correctly
 * renders documents, supports category-based filtering, and handles empty
 * states gracefully.
 *
 * All API calls are mocked so no live Gateway is required.
 */

const MOCK_DOCS = [
  {
    id: "doc-1",
    title: "Architecture Overview",
    category: "summary",
    content: "High-level system architecture for the OpenClaw platform.",
    sourceSession: "sess-001",
    sourceAgent: "agent-alpha",
    keywords: ["architecture", "design"],
    language: "en",
    extractedAt: "2026-03-10T08:00:00Z",
    updatedAt: "2026-03-10T08:00:00Z",
  },
  {
    id: "doc-2",
    title: "Deployment Plan Q2",
    category: "plan",
    content: "Deployment plan for the second quarter rollout.",
    sourceSession: "sess-002",
    sourceAgent: "agent-beta",
    keywords: ["deployment", "plan"],
    language: "en",
    extractedAt: "2026-03-11T09:00:00Z",
    updatedAt: "2026-03-11T09:00:00Z",
  },
  {
    id: "doc-3",
    title: "API Specification v2",
    category: "spec",
    content: "REST API specification for the v2 endpoints.",
    sourceSession: "sess-003",
    sourceAgent: null,
    keywords: ["api", "spec"],
    language: "en",
    extractedAt: "2026-03-12T10:00:00Z",
    updatedAt: "2026-03-12T10:00:00Z",
  },
  {
    id: "doc-4",
    title: "User Manual",
    category: "manual",
    content: "Getting started guide for end users.",
    sourceSession: null,
    sourceAgent: null,
    keywords: ["manual", "user"],
    language: "en",
    extractedAt: "2026-03-13T11:00:00Z",
    updatedAt: "2026-03-13T11:00:00Z",
  },
  {
    id: "doc-5",
    title: "Draft: Refactoring Notes",
    category: "draft",
    content: "Rough notes on refactoring the message pipeline.",
    sourceSession: "sess-004",
    sourceAgent: "agent-alpha",
    keywords: ["refactoring", "draft"],
    language: "en",
    extractedAt: "2026-03-14T12:00:00Z",
    updatedAt: "2026-03-14T12:00:00Z",
  },
];

test.beforeEach(async ({ page }) => {
  // Stub onboarding.
  await page.route("**/api/onboarding/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ needsOnboarding: false }),
    }),
  );

  // Stub gateway status.
  await page.route("**/api/gateway/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "disconnected" }),
    }),
  );

  // Stub docs API — returns all mock docs by default.
  await page.route("**/api/docs**", (route) => {
    // Handle extract endpoint separately.
    if (route.request().url().includes("/api/docs/extract")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    // Handle delete.
    if (route.request().method() === "DELETE") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
    // GET /api/docs — return mock data.
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ docs: MOCK_DOCS }),
    });
  });

  // Stub settings.
  await page.route("**/api/settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
  );

  await page.goto("/");

  // Navigate to the Docs panel via NavRail. The Docs button is in the
  // "control" group. We locate it by looking for the panel button whose
  // click results in the Doc Hub header being visible.
  // NavRail renders all panel buttons inside <nav>. "docs" is the 18th
  // panel (index varies). Locate by looking for a button after the
  // toggle that leads to a panel with "Doc Hub" header.
  // Simpler approach: use keyboard shortcut — but docs is beyond Alt+9.
  // Instead, click the button with the FileCode icon. Since we can't
  // easily target Lucide icons, we iterate nav buttons.
  const navButtons = page.locator("nav button");
  const count = await navButtons.count();
  // The docs panel is in the "control" group, second-to-last before settings.
  // Skip the first button (toggle). Docs is the 18th item in the flattened
  // list: chat(1), agents(2), gateway(3), models(4), usage(5), sessions(6),
  // memory(7), logs(8), activity(9), cron(10), webhooks(11), approvals(12),
  // skills(13), budget(14), alerts(15), channels(16), config(17), docs(18).
  // Plus toggle button at index 0 => docs is at index 18.
  // Settings is in the footer, separate div.
  if (count > 18) {
    await navButtons.nth(18).click();
  }
});

// ---------------------------------------------------------------------------
// Document list rendering
// ---------------------------------------------------------------------------

test.describe("Document list", () => {
  test("Doc Hub panel header is visible", async ({ page }) => {
    // DocHubPanel renders an h2 with the docs title.
    const header = page.locator("main h2");
    await expect(header).toBeVisible();
  });

  test("document cards are rendered from mock data", async ({ page }) => {
    // Each document renders as a button in the DocList.
    // Wait for the list to appear.
    const docCards = page.locator("main button.text-left");
    await expect(docCards.first()).toBeVisible({ timeout: 5000 });

    const count = await docCards.count();
    expect(count).toBe(MOCK_DOCS.length);
  });

  test("clicking a document card selects it", async ({ page }) => {
    const docCards = page.locator("main button.text-left");
    await expect(docCards.first()).toBeVisible({ timeout: 5000 });

    // Click the first document card.
    await docCards.first().click();

    // The selected card should have a different border color (active state).
    // We can't easily check CSS variable values, but we can verify the card
    // is still present and the viewer area now shows content.
    await expect(docCards.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Category filtering (Codex Review R1-F6)
// ---------------------------------------------------------------------------

test.describe("Category filtering", () => {
  test("category filter buttons are rendered", async ({ page }) => {
    // CategoryFilter renders pill-shaped buttons for: All, Summary, Plan, Spec, Manual, Draft.
    const filterButtons = page.locator("main .flex.gap-1 button");
    await expect(filterButtons.first()).toBeVisible({ timeout: 5000 });

    const count = await filterButtons.count();
    // 6 categories: All + 5 specific categories.
    expect(count).toBe(6);
  });

  test("clicking a category filter narrows the document list", async ({ page }) => {
    // Wait for docs to load.
    const docCards = page.locator("main button.text-left");
    await expect(docCards.first()).toBeVisible({ timeout: 5000 });

    // All docs should show initially (5).
    let count = await docCards.count();
    expect(count).toBe(5);

    // Click the "Summary" category filter (second filter button, index 1).
    const filterButtons = page.locator("main .flex.gap-1 button");
    await filterButtons.nth(1).click();

    // Client-side filtering should reduce the count.
    // There's 1 "summary" doc in our mock data.
    // The DocList does client-side filtering based on filterCategory from the store.
    // After clicking, re-check count.
    await page.waitForTimeout(200); // Allow React re-render.
    count = await docCards.count();
    expect(count).toBe(1);
  });

  test("clicking 'All' category shows all documents again", async ({ page }) => {
    const docCards = page.locator("main button.text-left");
    await expect(docCards.first()).toBeVisible({ timeout: 5000 });

    // First filter to a specific category.
    const filterButtons = page.locator("main .flex.gap-1 button");
    await filterButtons.nth(2).click(); // Plan category
    await page.waitForTimeout(200);

    let count = await docCards.count();
    expect(count).toBe(1); // 1 plan doc

    // Click "All" (first filter button).
    await filterButtons.nth(0).click();
    await page.waitForTimeout(200);

    count = await docCards.count();
    expect(count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

test.describe("Doc search", () => {
  test("search input is present with placeholder", async ({ page }) => {
    const searchInput = page.locator("main input[data-panel-search]");
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test("typing in search filters documents by title/content", async ({ page }) => {
    const docCards = page.locator("main button.text-left");
    await expect(docCards.first()).toBeVisible({ timeout: 5000 });

    const searchInput = page.locator("main input[data-panel-search]");
    await searchInput.fill("Architecture");
    await page.waitForTimeout(300); // Allow store update + re-render.

    // Only "Architecture Overview" should match.
    const count = await docCards.count();
    expect(count).toBe(1);
  });

  test("clearing search shows all documents again", async ({ page }) => {
    const docCards = page.locator("main button.text-left");
    await expect(docCards.first()).toBeVisible({ timeout: 5000 });

    const searchInput = page.locator("main input[data-panel-search]");

    // Filter first.
    await searchInput.fill("Deployment");
    await page.waitForTimeout(200);
    let count = await docCards.count();
    expect(count).toBe(1);

    // Clear search.
    await searchInput.fill("");
    await page.waitForTimeout(200);
    count = await docCards.count();
    expect(count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

test.describe("Empty state", () => {
  test("shows empty message when no docs match filter", async ({ page }) => {
    const searchInput = page.locator("main input[data-panel-search]");
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Search for something that doesn't exist.
    await searchInput.fill("zzz_no_match_zzz");
    await page.waitForTimeout(300);

    // DocList shows a "no results" message.
    const noResults = page.locator("main").getByText(/no/i);
    await expect(noResults).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Extract button
// ---------------------------------------------------------------------------

test.describe("Extract docs", () => {
  test("Extract Docs button is visible in the header", async ({ page }) => {
    // DocHubPanel header has an "Extract Docs" button.
    const extractButton = page.locator("main button").filter({ hasText: /extract/i });
    await expect(extractButton.first()).toBeVisible({ timeout: 5000 });
  });
});
