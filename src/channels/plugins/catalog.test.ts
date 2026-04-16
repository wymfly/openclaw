import { describe, expect, it } from "vitest";
import { buildChannelUiCatalog } from "./catalog.js";

describe("buildChannelUiCatalog", () => {
  it("projects plugin-aware metadata from the channel catalog entry", () => {
    const catalog = buildChannelUiCatalog(
      [
        {
          id: "telegram",
          meta: {
            id: "telegram",
            label: "Telegram",
            selectionLabel: "Telegram",
            docsPath: "/channels/telegram",
            blurb: "Telegram channel",
            detailLabel: "Telegram Bot",
            exposure: {
              configured: true,
              setup: true,
              docs: true,
            },
          },
        },
      ],
      {
        catalogPaths: [],
        officialCatalogPaths: [],
        env: process.env,
      },
    );

    expect(catalog.byId.telegram).toMatchObject({
      id: "telegram",
      label: "Telegram",
      detailLabel: "Telegram Bot",
    });
  });

  it("includes plugin identity/origin/install hints when catalog entries provide them", () => {
    const catalog = buildChannelUiCatalog(
      [
        {
          id: "wecom",
          meta: {
            id: "wecom",
            label: "WeCom",
            selectionLabel: "WeCom",
            docsPath: "/channels/wecom",
            blurb: "WeCom channel",
            detailLabel: "WeCom",
            exposure: {
              configured: true,
              setup: true,
              docs: true,
            },
          },
        },
      ],
      {
        catalogEntries: [
          {
            id: "wecom",
            pluginId: "wecom",
            origin: "bundled",
            meta: {
              id: "wecom",
              label: "WeCom",
              selectionLabel: "WeCom",
              docsPath: "/channels/wecom",
              blurb: "WeCom channel",
              detailLabel: "WeCom",
              exposure: {
                configured: true,
                setup: true,
                docs: true,
              },
            },
            install: {
              npmSpec: "@openclaw/wecom",
              localPath: "extensions/wecom",
              defaultChoice: "npm",
            },
          },
        ],
      },
    );

    expect(catalog.byId.wecom).toMatchObject({
      id: "wecom",
      pluginId: "wecom",
      pluginOrigin: "bundled",
      pluginNpmSpec: "@openclaw/wecom",
      pluginLocalPath: "extensions/wecom",
      pluginDefaultInstallChoice: "npm",
      pluginConfigPath: "plugins.entries.wecom.config",
    });
  });
});
