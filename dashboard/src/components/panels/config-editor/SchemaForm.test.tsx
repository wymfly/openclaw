// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SchemaForm } from "./SchemaForm";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("SchemaForm", () => {
  it("uses lookup-provided password hints to choose password field rendering", () => {
    render(
      <SchemaForm
        fields={[
          {
            key: "secret",
            type: "string",
          },
        ]}
        values={{ secret: "top-secret" }}
        onChange={vi.fn()}
        hints={{ secret: { inputType: "password" } }}
      />,
    );

    expect(screen.getByDisplayValue("top-secret").getAttribute("type")).toBe("password");
  });

  it("uses lookup-provided placeholder hints for string fields", () => {
    render(
      <SchemaForm
        fields={[
          {
            key: "host",
            type: "string",
          },
        ]}
        values={{ host: "" }}
        onChange={vi.fn()}
        hints={{ host: { placeholder: "lookup-host" } }}
      />,
    );

    expect(screen.getByPlaceholderText("lookup-host")).toBeTruthy();
  });
});
