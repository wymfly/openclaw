// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConfigStore } from "@/stores/config";
import { SectionNav } from "./SectionNav";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("SectionNav", () => {
  beforeEach(() => {
    useConfigStore.setState((state) => ({
      ...state,
      schema: {
        properties: {
          agents: {
            properties: {
              defaults: {},
              main: {},
            },
          },
        },
      },
      lookupSchema: vi.fn().mockResolvedValue({
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
      }),
      activeSection: null,
      schemaCache: new Map(),
    }));
  });

  it("loads typed lookup children when a section is expanded", async () => {
    render(<SectionNav sections={["agents"]} activeSection={null} onSelect={vi.fn()} />);

    const expandButton = screen.getAllByRole("button")[1];
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText("defaults")).toBeTruthy();
    });

    const lookupSchema = useConfigStore.getState().lookupSchema;
    expect(lookupSchema).toHaveBeenCalledWith("agents");
  });

  it("prefers cached lookup children count over bootstrap schema count badge", () => {
    useConfigStore.setState((state) => ({
      ...state,
      schemaCache: new Map([
        [
          "agents",
          {
            path: "agents",
            schema: {},
            children: [
              { key: "defaults", path: "agents.defaults", required: false, hasChildren: true },
            ],
          },
        ],
      ]),
    }));

    render(<SectionNav sections={["agents"]} activeSection={null} onSelect={vi.fn()} />);

    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });
});
