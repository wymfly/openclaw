// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConfigStore } from "@/stores/config";
import { ConfigPanel } from "./ConfigPanel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("./SectionNav", () => ({
  SectionNav: () => <div data-testid="section-nav" />,
}));

vi.mock("./SectionIntroCard", () => ({
  SectionIntroCard: () => <div data-testid="section-intro" />,
}));

vi.mock("./TagFilterPanel", () => ({
  TagFilterPanel: () => <div data-testid="tag-filter" />,
}));

vi.mock("./ConflictDialog", () => ({
  ConflictDialog: () => <div data-testid="conflict-dialog" />,
}));

vi.mock("./SchemaForm", () => ({
  SchemaForm: ({
    fields,
    hints,
  }: {
    fields: Array<{ key: string }>;
    hints?: Record<string, { sensitive?: boolean; placeholder?: string }>;
  }) => (
    <div data-testid="schema-form">
      {fields.map((field) => field.key).join(",")}|{JSON.stringify(hints ?? {})}
    </div>
  ),
}));

describe("ConfigPanel", () => {
  beforeEach(() => {
    useConfigStore.setState((state) => ({
      ...state,
      schema: {
        properties: {
          agents: {
            properties: {
              defaults: {
                properties: {
                  bootstrapOnly: { type: "string" },
                },
              },
            },
          },
        },
      },
      uiHints: null,
      rawConfig: "{}",
      editedConfig: "{}",
      isDirty: false,
      saving: false,
      conflict: false,
      loading: false,
      error: null,
      schemaCache: new Map(),
      activeSection: "agents.defaults",
      fetchSchema: vi.fn().mockResolvedValue(undefined),
      fetchConfig: vi.fn().mockResolvedValue(undefined),
      lookupSchema: vi.fn().mockImplementation(async (path: string) => {
        if (path === "") {
          return {
            path: "",
            schema: {},
            children: [
              {
                key: "agents",
                path: "agents",
                required: false,
                hasChildren: true,
              },
            ],
          };
        }
        if (path === "agents") {
          return {
            path: "agents",
            schema: {},
            children: [
              {
                key: "defaults",
                path: "agents.defaults",
                required: false,
                hasChildren: true,
              },
            ],
          };
        }
        return {
          path: "agents.defaults",
          schema: {
            properties: {
              lookupOnly: { type: "string" },
            },
          },
          children: [
            {
              key: "lookupOnly",
              path: "agents.defaults.lookupOnly",
              required: false,
              hasChildren: false,
              hint: {
                sensitive: true,
                placeholder: "lookup-secret",
              },
            },
          ],
        };
      }),
      saveConfig: vi.fn().mockResolvedValue(true),
      reloadConfig: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it("prefers active section lookup schema over bootstrap parse for visible fields", async () => {
    render(<ConfigPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("schema-form").textContent).toContain("lookupOnly");
    });

    expect(screen.getByTestId("schema-form").textContent).not.toContain("bootstrapOnly");
    expect(screen.getByTestId("schema-form").textContent).toContain("agents.defaults.lookupOnly");
    expect(screen.getByTestId("schema-form").textContent).toContain("lookup-secret");
  });

  it("prefetches top-level section lookups for search/indexing ownership", async () => {
    render(<ConfigPanel />);

    await waitFor(() => {
      expect(useConfigStore.getState().lookupSchema).toHaveBeenCalledWith("");
      expect(useConfigStore.getState().lookupSchema).toHaveBeenCalledWith("agents.defaults");
    });
  });
});
