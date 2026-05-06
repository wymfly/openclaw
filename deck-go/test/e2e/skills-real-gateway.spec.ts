import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
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
type SkillsFixture = {
  runId: string;
  skillDir: string;
  skillKey: string;
  skillName: string;
};
type RpcEvidence = {
  body: string;
  method: string;
  ok: boolean;
  payload: JsonObject;
  status: number;
};

test.describe("skills real OpenClaw Gateway contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Skills real Gateway E2E",
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

  test("creates run-scoped workspace skill data and verifies BFF/runtime contract shapes", async ({
    request,
  }, testInfo) => {
    const fixture = await createSkillsFixture(stack, "skills-api");
    const headers = authHeaders(stack.accessToken);

    try {
      const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
      expect(runtime.ok(), `runtime gateway returned ${runtime.status()}`).toBe(true);
      await expect(runtime.json()).resolves.toMatchObject({ mode: "bundled" });

      const describe = await expectOkJson(
        await request.get(`${stack.backendBase}/api/gateway/describe`, {
          headers,
          params: { includeSchemas: "true" },
        }),
        "gateway.describe",
      );
      const describeMethods = readRecord(describe.methods);
      for (const method of [
        "skills.status",
        "skills.bins",
        "skills.search",
        "skills.detail",
        "skills.install",
        "skills.update",
        "deck.agents.skills.get",
        "deck.agents.skills.set",
      ]) {
        expect(
          Object.prototype.hasOwnProperty.call(describeMethods, method),
          `gateway.describe missing ${method}`,
        ).toBe(true);
      }

      const status = await rpcMaybe(request, stack, "skills.status", {});
      expect(status.ok, status.body).toBe(true);
      const statusSkills = asArray(
        readRecord(status.payload.result).skills,
        "skills.status skills",
      );
      expect(
        statusSkills.some((entry) => isRunScopedSkill(entry, fixture)),
        "skills.status should include the run-scoped workspace skill",
      ).toBe(true);

      const bins = await rpcMaybe(request, stack, "skills.bins", {});
      expect(bins.ok, bins.body).toBe(true);
      const binValues = asArray(readRecord(bins.payload.result).bins, "skills.bins bins");
      expect(binValues).toContain("deck-go-e2e-skill");

      const skills = await expectOkJson(
        await request.get(`${stack.backendBase}/api/skills`, { headers }),
        "/skills",
      );
      const bffSkills = asArray(skills.skills, "/skills skills");
      expect(
        bffSkills.some((entry) => isRunScopedSkill(entry, fixture)),
        "/skills should include the run-scoped workspace skill",
      ).toBe(true);

      const agentSkills = await expectOkJson(
        await request.post(`${stack.backendBase}/api/deck/agents`, {
          headers,
          data: { action: "skills.get", agentId: "main" },
        }),
        "/deck/agents skills.get",
      );
      expect(Object.keys(agentSkills).length).toBeGreaterThan(0);

      const hubBins = await expectOkJson(
        await request.post(`${stack.backendBase}/api/skills/hub`, {
          headers,
          data: { action: "bins" },
        }),
        "/skills/hub bins",
      );
      expect(Array.isArray(hubBins.bins)).toBe(true);

      await writeRealE2EScenarioEvidence(
        stack,
        "skills-api-fixture",
        {
          scenarioId: "skills-api-fixture",
          runId: fixture.runId,
          status: "passed",
          fixture: {
            skillKey: fixture.skillKey,
            skillName: fixture.skillName,
            skillDir: fixture.skillDir,
          },
          methods: ["skills.status", "skills.bins", "deck.agents.skills.get"],
          writes: {
            installedSkillUpdate: "skipped-safe: avoids mutating operator skill config",
            hubInstall: "skipped-safe: avoids package-manager or hub-managed bin writes",
          },
        },
        testInfo,
      );
    } finally {
      await deleteSkillsFixture(fixture);
    }
  });

  test("renders Skills UI variants through shell navigation with real fixture data", async ({
    browser,
  }, testInfo) => {
    const fixture = await createSkillsFixture(stack, "skills-ui");
    const variants = [
      {
        configure: "Configure",
        expectedTitle: "Skills",
        files: "Files",
        locale: "en" as const,
        navLabel: "Skills",
        searchLabel: "Search skills",
        tabs: [
          ["Overview", "Identity"],
          ["Setup", "Pre-flight requirements"],
          ["Triggers", "Trigger keywords"],
          ["Bins", "Install options and bins"],
          ["Files", "File inventory is not a stable Deck-facing Skills DTO yet."],
          ["Audit", "No audit projection is available for this skill yet."],
        ] as const,
        theme: "dark" as const,
      },
      {
        configure: "配置",
        expectedTitle: "技能管理",
        files: "文件",
        locale: "zh" as const,
        navLabel: "技能",
        searchLabel: "搜索技能",
        tabs: [
          ["概览", "身份信息"],
          ["配置", "预检要求"],
          ["触发", "触发关键词"],
          ["命令", "安装选项与命令"],
          ["文件", "文件清单尚不是稳定的 Deck 技能 DTO。"],
          ["审计", "此技能暂无审计投影。"],
        ] as const,
        theme: "light" as const,
      },
    ];

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
            "skills",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("skills-panel");
          await expect(panel.getByRole("heading", { name: variant.expectedTitle })).toBeVisible();
          await expect(panel.getByLabel(variant.searchLabel)).toBeVisible();
          await panel.getByLabel(variant.searchLabel).fill(fixture.skillKey);
          await expect(panel.getByText(fixture.skillName).first()).toBeVisible();
          await panel.getByText(fixture.skillName).first().click();
          await expect(panel.getByRole("heading", { name: fixture.skillName })).toBeVisible();

          for (const [tab, expectedText] of variant.tabs) {
            const tabButton = panel.getByRole("tab", { name: tab });
            await tabButton.click();
            await expect(tabButton).toHaveAttribute("aria-selected", "true");
            await expect(panel.getByText(expectedText)).toBeVisible();
          }

          await panel.getByRole("button", { name: variant.configure }).click();
          await expect(page.getByRole("dialog", { name: variant.configure })).toBeVisible();
          await page
            .getByRole("button", { name: variant.locale === "en" ? "Close" : "关闭" })
            .click();
          await expect(page.getByRole("dialog", { name: variant.configure })).toBeHidden();

          await panel.getByRole("button", { name: variant.files }).click();
          await expect(
            page.getByRole("dialog", {
              name: variant.locale === "en" ? "Skill files" : "技能文件",
            }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: variant.locale === "en" ? "Close" : "关闭" })
            .click();

          await panel
            .locator("summary")
            .filter({ hasText: variant.locale === "en" ? "Agent skill matrix" : "智能体技能矩阵" })
            .click();
          await expect(panel.locator(".skills-panel__matrix-details")).toContainText(
            variant.locale === "en" ? "Agent skill matrix" : "智能体技能矩阵",
          );

          await panel.getByRole("button", { name: variant.expectedTitle }).click();
          await panel.getByRole("tab", { name: variant.locale === "en" ? "Hub" : "市场" }).click();
          await expect(panel.getByLabel(variant.searchLabel)).toBeVisible();
          await panel.getByLabel(variant.searchLabel).fill("git");

          await expect.poll(() => unexpected.slice()).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);
        } finally {
          await context.close();
        }
      }

      await writeRealE2EScenarioEvidence(
        stack,
        "skills-ui-variants",
        {
          scenarioId: "skills-ui-variants",
          runId: fixture.runId,
          status: "passed",
          fixture: {
            skillKey: fixture.skillKey,
            skillName: fixture.skillName,
          },
          variants: variants.map((variant) => ({
            locale: variant.locale,
            theme: variant.theme,
            nav: "chat -> skills",
            tabs: variant.tabs.map(([tab]) => tab),
          })),
          hubSearch:
            "skipped-safe: network-sensitive ClawHub search is not required for fixture-backed UI pass",
          directBrowserGatewayCalls: "none",
        },
        testInfo,
      );
    } finally {
      await deleteSkillsFixture(fixture);
    }
  });
});

async function createSkillsFixture(stack: E2EStack, label: string): Promise<SkillsFixture> {
  const runId = stack.realE2E?.runId ?? buildRunScopedName("deckgo-e2e", "skills");
  const skillKey = buildRunScopedName(runId, `${label}-skill`);
  const skillName = buildRunScopedName(runId, `${label}-skill-name`);
  const workspaceRoot = stack.realE2E?.workspaceRoot;
  expect(workspaceRoot, "real E2E isolation must provide a workspace root").toBeTruthy();
  const skillDir = path.join(workspaceRoot as string, "main", "skills", skillKey);
  assertRunScopedCleanupTarget({ skillKey, skillName, skillDir, runId }, runId);
  await mkdir(skillDir, { recursive: true, mode: 0o700 });
  const metadata = {
    openclaw: {
      skillKey,
      primaryEnv: "DECK_GO_E2E_SKILL_TOKEN",
      requires: { env: ["DECK_GO_E2E_SKILL_TOKEN"] },
      install: [
        {
          id: "e2e-download",
          kind: "download",
          label: "E2E download option",
          url: "https://example.com/deck-go-e2e-skill.tgz",
          bins: ["deck-go-e2e-skill"],
        },
      ],
    },
  };
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: Run-scoped Skills real E2E fixture ${runId}\nmetadata: ${JSON.stringify(
      metadata,
    )}\n---\n\n# ${skillName}\n\nThis fixture is created by deck-go real E2E and removed after the scenario.\n`,
    "utf8",
  );
  return { runId, skillDir, skillKey, skillName };
}

async function deleteSkillsFixture(fixture: SkillsFixture) {
  assertRunScopedCleanupTarget(fixture, fixture.runId);
  await rm(fixture.skillDir, { recursive: true, force: true });
}

async function rpcMaybe(
  request: APIRequestContext,
  stack: E2EStack,
  method: string,
  params: JsonObject,
): Promise<RpcEvidence> {
  const response = await request.post(`${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`, {
    headers: authHeaders(stack.accessToken),
    data: { method, params, timeoutMs: 5000 },
  });
  const status = response.status();
  const text = await response.text();
  const payload = parseJsonObject(text);
  if (!response.ok()) {
    expect([400, 404, 501, 502, 503], `${method} degraded with ${status}`).toContain(status);
    return { body: text.slice(0, 2000), method, ok: false, payload, status };
  }
  expect(payload.runtimeId).toBe("rt_local");
  return { body: text.slice(0, 2000), method, ok: true, payload, status };
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

function readRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asArray(value: unknown, label: string) {
  expect(Array.isArray(value), `${label} should be an array`).toBe(true);
  return value as unknown[];
}

function parseJsonObject(text: string): JsonObject {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : { raw: parsed };
  } catch {
    return {};
  }
}

function isRunScopedSkill(value: unknown, fixture: SkillsFixture) {
  if (typeof value === "string") {
    return value.includes(fixture.skillKey) || value.includes(fixture.skillName);
  }
  const record = readRecord(value);
  return [record.key, record.skillKey, record.name, record.description].some(
    (entry) =>
      typeof entry === "string" &&
      (entry.includes(fixture.skillKey) || entry.includes(fixture.skillName)),
  );
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
    if (url.startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.push(`response: ${status} ${url}`);
    }
  });
  return unexpected;
}
