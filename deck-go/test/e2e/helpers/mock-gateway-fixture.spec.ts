import { expect, test } from "@playwright/test";
import { startMockGateway, stopMockGateway } from "./mock-gateway-fixture";

test("mock gateway fixture starts on a known port and stops cleanly", async () => {
  const handle = await startMockGateway({ port: 18991, token: "fixture-token" });

  try {
    const response = await fetch(`${handle.url}/healthz`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK\n");
  } finally {
    await stopMockGateway(handle);
  }
});
