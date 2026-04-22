// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AllowFromEditor } from "./AllowFromEditor";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const table: Record<string, string> = {
      count: `${values?.count ?? 0} entries`,
      placeholder: "Add an entry",
      add: "Add",
      empty: "No entries configured.",
      bulkTitle: "Bulk Import",
      bulkPlaceholder: "Paste entries",
      bulkApply: "Apply",
      invalid: `Invalid entry: ${values?.entry ?? ""}`,
      remove: `Remove ${values?.entry ?? ""}`,
    };
    return table[key] ?? key;
  },
}));

describe("AllowFromEditor", () => {
  it("normalizes, adds, removes, and bulk imports entries", () => {
    let current = ["user-1"];
    const onChange = vi.fn((next: string[]) => {
      current = next;
      rerender(
        <AllowFromEditor
          entries={current}
          onChange={onChange}
          normalize={(raw) =>
            raw
              .trim()
              .toLowerCase()
              .replace(/^user:/, "")
          }
        />,
      );
    });

    const { rerender } = render(
      <AllowFromEditor
        entries={current}
        onChange={onChange}
        normalize={(raw) =>
          raw
            .trim()
            .toLowerCase()
            .replace(/^user:/, "")
        }
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Add an entry"), {
      target: { value: "USER:new-user" },
    });
    fireEvent.click(screen.getByText("Add"));

    expect(onChange).toHaveBeenLastCalledWith(["user-1", "new-user"]);

    fireEvent.click(screen.getByLabelText("Remove user-1"));
    expect(onChange).toHaveBeenLastCalledWith(["new-user"]);

    fireEvent.click(screen.getByText("Bulk Import"));
    fireEvent.change(screen.getByPlaceholderText("Paste entries"), {
      target: { value: "user:alpha\nbeta" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(onChange).toHaveBeenLastCalledWith(["new-user", "alpha", "beta"]);
  });
});
