import { afterEach, describe, expect, it, vi } from "vitest";
import { mergePluginLocales } from "../plugin-locales";

describe("mergePluginLocales", () => {
  it("merges plugin locale bundles under the plugin namespace", () => {
    const messages = mergePluginLocales(
      {
        wizard: {
          recommended: "Recommended",
        },
      },
      [
        {
          id: "feishu",
          locales: {
            en: {
              title: "Configure Feishu",
            },
          },
        },
      ],
      "en",
    );

    expect(messages).toEqual({
      wizard: {
        recommended: "Recommended",
      },
      plugin: {
        feishu: {
          title: "Configure Feishu",
        },
      },
    });
  });

  it("falls back to the english plugin bundle when the requested locale is missing", () => {
    const messages = mergePluginLocales(
      {},
      [
        {
          id: "feishu",
          locales: {
            en: {
              title: "Configure Feishu",
            },
          },
        },
      ],
      "zh",
    );

    expect(messages).toEqual({
      plugin: {
        feishu: {
          title: "Configure Feishu",
        },
      },
    });
  });

  it("preserves existing plugin namespace entries while merging new bundles", () => {
    const messages = mergePluginLocales(
      {
        plugin: {
          wecom: {
            title: "Configure WeCom",
          },
        },
      },
      [
        {
          id: "feishu",
          locales: {
            zh: {
              title: "配置飞书",
            },
          },
        },
      ],
      "zh",
    );

    expect(messages).toEqual({
      plugin: {
        wecom: {
          title: "Configure WeCom",
        },
        feishu: {
          title: "配置飞书",
        },
      },
    });
  });
});

describe("getPluginLocaleInventory", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    globalThis.fetch = originalFetch;
    if (originalApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
    }
  });

  it("returns an empty list when the control-plane base is not configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const { getPluginLocaleInventory } = await import("../plugin-locales");

    await expect(getPluginLocaleInventory()).resolves.toEqual([]);
  });

  it("fetches plugin locales from the Stage 2 control-plane", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runtimeId: "rt_local",
          payload: {
            plugins: [
              {
                id: "feishu",
                locales: {
                  en: { title: "Configure Feishu" },
                },
              },
            ],
          },
          requestId: "req-1",
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock;
    const { getPluginLocaleInventory } = await import("../plugin-locales");

    await expect(getPluginLocaleInventory()).resolves.toEqual([
      {
        id: "feishu",
        locales: {
          en: { title: "Configure Feishu" },
        },
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/deck/plugins?capability=all",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
