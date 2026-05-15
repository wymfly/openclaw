import { expect, test, type TestInfo } from "@playwright/test";
import { openDeck, startLocalStack, type E2EStack } from "./helpers";

type LifecycleCase = {
  state: "running" | "stopped" | "not-installed" | "unhealthy";
  visible: string[];
  hidden: string[];
  lastError?: string;
};

const lifecycleCases: LifecycleCase[] = [
  {
    state: "running",
    visible: ["Stop", "Restart"],
    hidden: ["Start", "Reinstall", "Install and start"],
  },
  {
    state: "stopped",
    visible: ["Start", "Reinstall"],
    hidden: ["Stop", "Restart", "Install and start"],
  },
  {
    state: "not-installed",
    visible: ["Install and start"],
    hidden: ["Stop", "Restart", "Start", "Reinstall"],
    lastError: "entrypoint_not_found",
  },
  {
    state: "unhealthy",
    visible: ["Restart", "Reinstall"],
    hidden: ["Stop", "Start", "Install and start"],
    lastError: "probe_non_ok",
  },
];

for (const scenario of lifecycleCases) {
  test(`renders OperationsPanel controls for ${scenario.state}`, async ({ page }, testInfo) => {
    const stack = await startOperationsStack(testInfo, scenario.state);
    try {
      await openDeck(page, stack.frontendBase, "gateway");

      const panel = page.locator(".gateway-operations");
      await expect(panel).toBeVisible();
      await expect(panel.getByText(scenario.state).first()).toBeVisible();
      await expect(panel.getByText(/openclaw-gateway\./).first()).toBeVisible();
      await expect(panel.getByText(/entrypoint/).first()).toBeVisible();

      if (scenario.lastError) {
        await expect(panel.getByText(scenario.lastError).first()).toBeVisible();
      }

      for (const label of scenario.visible) {
        await expect(panel.getByRole("button", { name: label, exact: true })).toBeVisible();
      }
      for (const label of scenario.hidden) {
        await expect(panel.getByRole("button", { name: label, exact: true })).toHaveCount(0);
      }
    } finally {
      await stack.stop();
    }
  });
}

async function startOperationsStack(
  testInfo: TestInfo,
  lifecycleState: LifecycleCase["state"],
): Promise<E2EStack> {
  return await startLocalStack(testInfo, { lifecycleState });
}
