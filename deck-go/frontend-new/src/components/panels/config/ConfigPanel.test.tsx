// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { ConfigPanel } from "./ConfigPanel";

const apiMocks = vi.hoisted(() => ({
  applyDeckConfig: vi.fn(),
  fetchDeckConfig: vi.fn(),
  lookupConfigPath: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function configPayload() {
  const config = {
    agents: {
      defaults: {
        apiKey: "test-secret",
        enabled: true,
        mode: "auto",
        maxTokens: 1000,
        model: "gpt-5.4",
        sandbox: { mode: "workspace-write" },
      },
    },
    models: { providers: { openai: {} } },
  };
  return {
    config,
    baseHash: "config-base-h1",
    hash: "config-h1",
    raw: JSON.stringify(config, null, 2),
  };
}

function lookupPayload(path = "agents.defaults") {
  return {
    path,
    schema: {
      type: "object",
      properties: {
        apiKey: { type: "string" },
        enabled: { type: "boolean" },
        maxTokens: { type: "number" },
        mode: { type: "string", enum: ["auto", "manual"] },
        model: { type: "string" },
        sandbox: { type: "object" },
      },
    },
    children: [
      {
        key: "apiKey",
        path: "agents.defaults.apiKey",
        type: "string",
        required: false,
        hasChildren: false,
        hint: {
          label: "API key",
          placeholder: "secret value",
          sensitive: true,
          tags: ["sensitive"],
        },
      },
      {
        key: "model",
        path: "agents.defaults.model",
        type: "string",
        required: false,
        hasChildren: false,
        hint: { label: "Default model", placeholder: "model id", tags: ["common"] },
      },
      {
        key: "mode",
        path: "agents.defaults.mode",
        type: "string",
        required: false,
        hasChildren: false,
        hint: { label: "Default mode" },
      },
      {
        key: "maxTokens",
        path: "agents.defaults.maxTokens",
        type: "number",
        required: false,
        hasChildren: false,
      },
      {
        key: "enabled",
        path: "agents.defaults.enabled",
        type: "boolean",
        required: false,
        hasChildren: false,
      },
      {
        key: "sandbox",
        path: "agents.defaults.sandbox",
        type: "object",
        required: false,
        hasChildren: true,
        hint: { tags: ["advanced"] },
      },
    ],
  };
}

function rootLookupPayload() {
  return {
    path: "",
    schema: { type: "object" },
    children: [
      {
        key: "agents",
        path: "agents",
        required: false,
        hasChildren: true,
      },
      {
        key: "models",
        path: "models",
        required: false,
        hasChildren: true,
      },
    ],
  };
}

function renderConfigPanel(locale: "en" | "zh" = "en") {
  return createElement(DeckIntlProvider, { locale }, createElement(ConfigPanel));
}

function findButton(label: string) {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === label,
  );
}

async function clickButton(label: string) {
  await act(async () => {
    findButton(label)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function openRawPane(label = "Raw") {
  await clickButton(label);
  await waitFor(() =>
    expect(container.querySelector('[data-testid="config-raw-editor"]')).toBeTruthy(),
  );
}

function rawEditor() {
  return container.querySelector<HTMLTextAreaElement>('[data-testid="config-raw-editor"]');
}

describe("ConfigPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchDeckConfig.mockResolvedValue(configPayload());
    apiMocks.lookupConfigPath.mockImplementation((path: string) =>
      Promise.resolve(path === "" ? rootLookupPayload() : lookupPayload(path)),
    );
    apiMocks.applyDeckConfig.mockResolvedValue({ ok: true, hash: "config-h2" });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.clearAllMocks();
  });

  it("loads config snapshots, top-level keys, and default schema lookup", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() => expect(apiMocks.fetchDeckConfig).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain("Snapshot in sync"));

    expect(apiMocks.lookupConfigPath).toHaveBeenCalledWith("agents");
    expect(apiMocks.lookupConfigPath).toHaveBeenCalledWith("");
    expect(container.textContent).toContain("2 top-level keys");
    expect(container.textContent).toContain("base config-base-h1");
    expect(container.textContent).toContain("agents");
    expect(container.textContent).toContain("models");
    expect(container.textContent).toContain("Showing 6 of 6 structured fields");
    expect(container.textContent).toContain("Configuration");
    expect(container.textContent).toContain("Draft preview");
    expect(container.textContent).toContain("Default model");
    expect(container.querySelector(".config-panel")).toBeTruthy();
    expect(container.querySelector(".config-panel__topbar")).toBeTruthy();
    expect(container.querySelector(".config-panel__section-nav")).toBeTruthy();
    expect(container.querySelector(".config-panel__form-pane")).toBeTruthy();
    expect(container.querySelector(".config-panel__preview-pane")).toBeTruthy();
    expect(container.querySelector(".config-panel__pill-row")).toBeTruthy();
    expect(container.querySelectorAll(".config-panel__input").length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll(".config-panel__actions").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".config-panel__button").length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll(".config-panel__field-card")).toHaveLength(6);
    expect(container.querySelector(".config-panel__preview-empty")).toBeTruthy();

    await openRawPane();
    expect(rawEditor()).toBeTruthy();
  });

  it("renders localized Chinese config editor and schema surfaces", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel("zh"));
    });

    await waitFor(() => expect(container.textContent).toContain("快照已同步"));

    expect(container.textContent).toContain("2 个顶层键");
    expect(container.textContent).toContain("配置治理");
    expect(container.textContent).toContain("草稿预览");
    expect(container.textContent).toContain("Schema 分区");
    expect(container.textContent).toContain("应用配置");

    await openRawPane("原始");
    expect(container.textContent).toContain("原始配置");
  });

  it("keeps synthesized raw snapshots read-only when the Gateway omits raw text", async () => {
    apiMocks.fetchDeckConfig.mockResolvedValueOnce({
      config: { agents: { defaults: { model: "gpt-5.4" } } },
      baseHash: "config-base-h1",
      hash: "config-h1",
      raw: null,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("Snapshot in sync"));

    expect(container.textContent).toContain("Raw config text is unavailable");
    await openRawPane();
    expect(rawEditor()?.readOnly).toBe(true);
    expect(findButton("Apply config")?.disabled).toBe(true);
  });

  it("uses password inputs for sensitive structured string fields and can reveal them", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("API key"));

    const apiKeyInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Edit agents.defaults.apiKey"]',
    );
    expect(apiKeyInput).toBeTruthy();
    expect(apiKeyInput?.type).toBe("password");
    expect(container.textContent).toContain("sensitive");

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Toggle visibility agents.defaults.apiKey"]',
        )
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Edit agents.defaults.apiKey"]')
        ?.type,
    ).toBe("text");

    await act(async () => {
      fireEvent.change(
        container.querySelector<HTMLInputElement>(
          'input[aria-label="Edit agents.defaults.apiKey"]',
        ) as HTMLInputElement,
        { target: { value: "updated-secret" } },
      );
    });

    await openRawPane();
    const rawValue = rawEditor()?.value ?? "";
    const parsedRaw = JSON.parse(rawValue) as {
      agents?: { defaults?: { apiKey?: string } };
    };
    expect(parsedRaw.agents?.defaults?.apiKey).toBe("updated-secret");
  });

  it("looks up edited schema paths and applies edited raw config with the base hash", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("Snapshot in sync"));
    await waitFor(() =>
      expect(container.textContent).toContain("Showing 6 of 6 structured fields"),
    );

    const pathInput = Array.from(container.querySelectorAll("input")).find(
      (input) => input.getAttribute("placeholder") === "config path",
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(pathInput, { target: { value: " agents.defaults.model " } });
    });

    await clickButton("Lookup schema");

    await waitFor(() =>
      expect(apiMocks.lookupConfigPath).toHaveBeenLastCalledWith("agents.defaults.model"),
    );

    const nextRaw = JSON.stringify({ agents: { defaults: { model: "sonnet-4.6" } } });
    await openRawPane();
    const textarea = rawEditor() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: nextRaw } });
    });

    await clickButton("Apply config");

    expect(apiMocks.applyDeckConfig).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Config diff preview");
    expect(container.textContent).toContain("pending config changes");
    expect(container.textContent).toContain("agents.defaults.model");

    await clickButton("Confirm apply config");

    await waitFor(() =>
      expect(apiMocks.applyDeckConfig).toHaveBeenCalledWith(nextRaw, "config-base-h1"),
    );
    await clickButton("View snapshot");
    expect(container.textContent).toContain("Last apply result");
  });

  it("loads the latest config and retries local edits with the latest hash after apply conflicts", async () => {
    const remotePayload = {
      config: {
        agents: {
          defaults: {
            enabled: true,
            mode: "manual",
            model: "remote-model",
          },
        },
      },
      hash: "config-h2",
      raw: JSON.stringify({
        agents: {
          defaults: {
            enabled: true,
            mode: "manual",
            model: "remote-model",
          },
        },
      }),
    };
    apiMocks.fetchDeckConfig
      .mockResolvedValueOnce(configPayload())
      .mockResolvedValueOnce(remotePayload)
      .mockResolvedValue(configPayload());
    apiMocks.applyDeckConfig.mockRejectedValueOnce(
      new Error("config changed since last load; re-run config.get and retry"),
    );

    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("Snapshot in sync"));

    const localRaw = JSON.stringify({ agents: { defaults: { model: "local-model" } } });
    await openRawPane();
    const textarea = rawEditor() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: localRaw } });
    });

    await clickButton("Apply config");

    await clickButton("Confirm apply config");

    await waitFor(() => expect(container.textContent).toContain("Config apply conflict"));
    expect(container.textContent).toContain("config-h2");
    expect(container.textContent).toContain("agents.defaults.model");
    expect(apiMocks.applyDeckConfig).toHaveBeenCalledWith(localRaw, "config-base-h1");

    await clickButton("Retry local config with latest hash");

    await waitFor(() => expect(apiMocks.applyDeckConfig).toHaveBeenCalledTimes(2));
    expect(apiMocks.applyDeckConfig).toHaveBeenLastCalledWith(localRaw, "config-h2");
  });

  it("writes primitive structured field edits back into the raw config snapshot", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() =>
      expect(container.textContent).toContain("Showing 6 of 6 structured fields"),
    );

    const modelInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Edit agents.defaults.model"]',
    );
    const maxTokensInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Edit agents.defaults.maxTokens"]',
    );
    const modeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Edit agents.defaults.mode"]',
    );
    const enabledInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Edit agents.defaults.enabled"]',
    );

    expect(modelInput).toBeTruthy();
    expect(maxTokensInput).toBeTruthy();
    expect(modeSelect).toBeTruthy();
    expect(enabledInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(modelInput as HTMLInputElement, { target: { value: "sonnet-4.6" } });
    });
    await act(async () => {
      fireEvent.change(maxTokensInput as HTMLInputElement, { target: { value: "2048" } });
    });
    await act(async () => {
      fireEvent.change(modeSelect as HTMLSelectElement, { target: { value: "manual" } });
    });
    await act(async () => {
      fireEvent.click(enabledInput as HTMLInputElement);
    });

    await openRawPane();
    const rawValue = rawEditor()?.value ?? "";
    const parsedRaw = JSON.parse(rawValue) as {
      agents?: {
        defaults?: { enabled?: boolean; maxTokens?: number; mode?: string; model?: string };
      };
    };
    expect(parsedRaw.agents?.defaults?.model).toBe("sonnet-4.6");
    expect(parsedRaw.agents?.defaults?.maxTokens).toBe(2048);
    expect(parsedRaw.agents?.defaults?.mode).toBe("manual");
    expect(parsedRaw.agents?.defaults?.enabled).toBe(false);

    await clickButton("Apply config");

    expect(container.textContent).toContain("Config diff preview");

    await clickButton("Confirm apply config");

    await waitFor(() => expect(apiMocks.applyDeckConfig).toHaveBeenCalledTimes(1));
    const [appliedRaw, appliedHash] = apiMocks.applyDeckConfig.mock.calls[0] as [string, string];
    const applied = JSON.parse(appliedRaw) as {
      agents?: {
        defaults?: { enabled?: boolean; maxTokens?: number; mode?: string; model?: string };
      };
    };
    expect(applied.agents?.defaults?.model).toBe("sonnet-4.6");
    expect(applied.agents?.defaults?.maxTokens).toBe(2048);
    expect(applied.agents?.defaults?.mode).toBe("manual");
    expect(applied.agents?.defaults?.enabled).toBe(false);
    expect(appliedHash).toBe("config-base-h1");
  });

  it("writes nested structured JSON field edits back into the raw config snapshot", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() =>
      expect(container.textContent).toContain("Showing 6 of 6 structured fields"),
    );

    const sandboxTextarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Edit JSON agents.defaults.sandbox"]',
    );
    expect(sandboxTextarea).toBeTruthy();

    await act(async () => {
      fireEvent.change(sandboxTextarea as HTMLTextAreaElement, {
        target: { value: JSON.stringify({ mode: "read-only", network: false }, null, 2) },
      });
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Apply JSON agents.defaults.sandbox"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await openRawPane();
    const rawValue = rawEditor()?.value ?? "";
    const parsedRaw = JSON.parse(rawValue) as {
      agents?: { defaults?: { sandbox?: { mode?: string; network?: boolean } } };
    };
    expect(parsedRaw.agents?.defaults?.sandbox?.mode).toBe("read-only");
    expect(parsedRaw.agents?.defaults?.sandbox?.network).toBe(false);

    await clickButton("Apply config");

    expect(container.textContent).toContain("Config diff preview");

    await clickButton("Confirm apply config");

    await waitFor(() => expect(apiMocks.applyDeckConfig).toHaveBeenCalledTimes(1));
    const [appliedRaw] = apiMocks.applyDeckConfig.mock.calls[0] as [string, string];
    const applied = JSON.parse(appliedRaw) as {
      agents?: { defaults?: { sandbox?: { mode?: string; network?: boolean } } };
    };
    expect(applied.agents?.defaults?.sandbox?.mode).toBe("read-only");
    expect(applied.agents?.defaults?.sandbox?.network).toBe(false);
  });

  it("filters structured fields by text and schema hint tags", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() =>
      expect(container.textContent).toContain("Showing 6 of 6 structured fields"),
    );

    const fieldFilterInput = Array.from(container.querySelectorAll("input")).find(
      (input) => input.getAttribute("placeholder") === "Filter structured fields",
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fieldFilterInput, { target: { value: "sandbox" } });
    });

    expect(container.textContent).toContain("Showing 1 of 6 structured fields");
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Edit agents.defaults.model"]'),
    ).toBeNull();
    expect(
      container.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Edit JSON agents.defaults.sandbox"]',
      ),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.change(fieldFilterInput, { target: { value: "" } });
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "advanced")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Showing 1 of 6 structured fields");
    expect(
      container.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Edit JSON agents.defaults.sandbox"]',
      ),
    ).toBeTruthy();
  });

  it("tracks unsaved raw edits, guards navigation, and resets to the loaded snapshot", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("Snapshot in sync"));
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(cleanEvent)).toBe(true);

    await openRawPane();
    const textarea = rawEditor() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, {
        target: { value: JSON.stringify({ agents: { defaults: { model: "edited" } } }) },
      });
    });

    expect(container.textContent).toContain("6 unsaved");
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(dirtyEvent)).toBe(false);

    await clickButton("Reset edits");

    expect(rawEditor()?.value).toContain("gpt-5.4");
    expect(container.textContent).toContain("Snapshot in sync");
  });

  it("navigates schema sections and inspects the matching config value", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderConfigPanel());
    });

    await waitFor(() => expect(container.textContent).toContain("2 top-level keys"));
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Edit agents.defaults.model"]')
        ?.value,
    ).toBe("gpt-5.4");

    const filterInput = Array.from(container.querySelectorAll("input")).find(
      (input) => input.getAttribute("placeholder") === "Filter sections",
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(filterInput, { target: { value: "mod" } });
    });

    expect(container.textContent).not.toContain("Config section: models");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Models"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.lookupConfigPath).toHaveBeenLastCalledWith("models"));
    await clickButton("View snapshot");
    expect(container.textContent).toContain("Config section: models");
    expect(container.textContent).toContain("providers");
    expect(container.textContent).toContain("openai");
  });
});
