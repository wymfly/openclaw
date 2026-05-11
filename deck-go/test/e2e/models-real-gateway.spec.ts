import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  assertRunScopedCleanupTarget,
  authHeaders,
  buildRunScopedName,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;
type ModelsDetail = {
  detail: {
    hash: string;
    mode: "merge" | "replace";
    providers: Array<{
      id: string;
      api?: string;
      apiKeyStatus?: JsonObject;
      models: Array<{ id: string; name?: string; inputs?: string[]; reasoning?: boolean }>;
    }>;
  };
};
type ImpactPreviewResponse = {
  preview: {
    impactToken: string;
    severity: string;
    references: unknown[];
  };
};

const REAL_E2E_SECRET_REF_ID = "OPENCLAW_CONFIG_PATH";

test.describe("models real typed BFF control chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Models real Gateway E2E",
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

  test("creates, reads back, previews, and cleans up run-scoped provider/model data", async ({
    request,
  }, testInfo) => {
    const runId = stack.realE2E?.runId ?? buildRunScopedName("deckgo", "models-real");
    const providerId = buildRunScopedName(runId, "models-provider").slice(0, 58);
    const modelId = buildRunScopedName(runId, "model").slice(0, 58);
    const modelName = buildRunScopedName(runId, "Model");
    assertRunScopedCleanupTarget([providerId, modelId, modelName], runId);

    let cleanupAttempted = false;
    try {
      let detail = await getModelsDetail(request, stack);
      const createProvider = await postJson(request, stack, "/models/providers/upsert", {
        expectedBaseHash: detail.detail.hash,
        providerId,
        isCreate: true,
        api: "openai-responses",
        auth: "api-key",
        baseUrl: "https://api.openai.com/v1",
        apiKey: {
          action: "set-ref",
          ref: { source: "env", provider: "default", id: REAL_E2E_SECRET_REF_ID },
        },
        models: [
          {
            id: modelId,
            name: modelName,
            reasoning: "enable",
            inputs: ["text"],
            contextWindow: 64000,
            maxTokens: 4096,
          },
        ],
      });
      expect(createProvider.ok).toBe(true);

      detail = await getModelsDetail(request, stack);
      const provider = findProvider(detail, providerId);
      expect(provider).toBeTruthy();
      expect(provider?.apiKeyStatus?.state).toBe("ref");
      const apiKeyRef = provider?.apiKeyStatus?.ref as JsonObject | undefined;
      expect(apiKeyRef).toMatchObject({
        source: "env",
        provider: "default",
      });
      expect(typeof apiKeyRef?.id).toBe("string");
      const createdModel = findProvider(detail, providerId)?.models.find(
        (model) => model.id === modelId,
      );
      expect(createdModel).toMatchObject({
        id: modelId,
        name: modelName,
        reasoning: true,
        inputs: ["text"],
      });

      const modeDryRun = await postJson(request, stack, "/models/mode/set", {
        expectedBaseHash: detail.detail.hash,
        mode: "merge",
        dryRun: true,
      });
      expect(modeDryRun.ok).toBe(true);
      expect(modeDryRun.preview).toBeTruthy();

      detail = await getModelsDetail(request, stack);
      const modelPreview = (await postJson(request, stack, "/models/models/delete-preview", {
        expectedBaseHash: detail.detail.hash,
        providerId,
        modelId,
      })) as ImpactPreviewResponse;
      expect(modelPreview.preview.impactToken).toBeTruthy();
      expect(modelPreview.preview.references).toEqual([]);

      detail = await getModelsDetail(request, stack);
      const providerPreview = (await postJson(request, stack, "/models/providers/delete-preview", {
        expectedBaseHash: detail.detail.hash,
        providerId,
      })) as ImpactPreviewResponse;
      expect(providerPreview.preview.impactToken).toBeTruthy();
      expect(providerPreview.preview.references).toEqual([]);

      const deleteProvider = await postJson(request, stack, "/models/providers/delete", {
        expectedBaseHash: detail.detail.hash,
        providerId,
        impactToken: providerPreview.preview.impactToken,
        confirmText: "delete",
      });
      expect(deleteProvider.ok).toBe(true);
      cleanupAttempted = true;

      await expect
        .poll(async () => findProvider(await getModelsDetail(request, stack), providerId), {
          timeout: 10_000,
        })
        .toBeUndefined();

      await writeRealE2EScenarioEvidence(
        stack,
        "models-typed-bff-real-smoke",
        {
          scenarioId: "models-typed-bff-real-smoke",
          status: "passed",
          runId,
          providerId,
          modelId,
          exercised: [
            "GET /api/models/config/detail",
            "POST /api/models/providers/upsert with run-scoped model",
            "POST /api/models/mode/set dryRun",
            "POST /api/models/models/delete-preview",
            "POST /api/models/providers/delete-preview",
            "POST /api/models/providers/delete",
          ],
        },
        testInfo,
      );
    } finally {
      if (!cleanupAttempted) {
        await cleanupProviderIfPresent(request, stack, providerId).catch(() => {});
      }
    }
  });
});

async function getModelsDetail(request: APIRequestContext, stack: E2EStack) {
  return (await expectOkJson(request, stack, "GET", "/models/config/detail")) as ModelsDetail;
}

async function postJson(
  request: APIRequestContext,
  stack: E2EStack,
  path: string,
  data: JsonObject,
) {
  return expectOkJson(request, stack, "POST", path, data);
}

async function expectOkJson(
  request: APIRequestContext,
  stack: E2EStack,
  method: "GET" | "POST",
  path: string,
  data?: JsonObject,
) {
  const response =
    method === "GET"
      ? await request.get(`${stack.backendBase}/api${path}`, {
          headers: authHeaders(stack.accessToken),
        })
      : await request.post(`${stack.backendBase}/api${path}`, {
          headers: authHeaders(stack.accessToken),
          data,
        });
  const text = await response.text();
  expect(response.ok(), `${method} ${path} returned ${response.status()}: ${text}`).toBe(true);
  return JSON.parse(text) as JsonObject;
}

function findProvider(detail: ModelsDetail, providerId: string) {
  return detail.detail.providers.find((provider) => provider.id === providerId);
}

async function cleanupProviderIfPresent(
  request: APIRequestContext,
  stack: E2EStack,
  providerId: string,
) {
  const detail = await getModelsDetail(request, stack);
  const provider = findProvider(detail, providerId);
  if (!provider) {
    return;
  }
  let currentDetail = detail;
  for (const model of provider.models) {
    const preview = (await postJson(request, stack, "/models/models/delete-preview", {
      expectedBaseHash: currentDetail.detail.hash,
      providerId,
      modelId: model.id,
    })) as ImpactPreviewResponse;
    currentDetail = await getModelsDetail(request, stack);
    await postJson(request, stack, "/models/models/delete", {
      expectedBaseHash: currentDetail.detail.hash,
      providerId,
      modelId: model.id,
      impactToken: preview.preview.impactToken,
      confirmText: "delete",
    });
    currentDetail = await getModelsDetail(request, stack);
  }
  const providerPreview = (await postJson(request, stack, "/models/providers/delete-preview", {
    expectedBaseHash: currentDetail.detail.hash,
    providerId,
  })) as ImpactPreviewResponse;
  await postJson(request, stack, "/models/providers/delete", {
    expectedBaseHash: currentDetail.detail.hash,
    providerId,
    impactToken: providerPreview.preview.impactToken,
    confirmText: "delete",
  });
}
