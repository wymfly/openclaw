import { describe, expect, it } from "vitest";
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
