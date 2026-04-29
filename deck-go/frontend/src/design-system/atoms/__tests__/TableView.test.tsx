// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { TableView } from "../TableView";
import { render } from "./render-component";

describe("TableView", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: ReactElement) {
    const result = render(node);
    cleanups.push(result.unmount);
    return result;
  }

  it("renders headers and rows", () => {
    const { container } = mount(
      <TableView
        headers={["A", "B"]}
        rows={[
          ["1", "2"],
          ["3", "4"],
        ]}
      />,
    );
    const ths = container.querySelectorAll("th");
    expect(ths[0]?.textContent).toBe("A");
    expect(ths[0]?.getAttribute("scope")).toBe("col");
    expect(container.querySelectorAll("tbody tr").length).toBe(2);
    expect(container.querySelectorAll("tbody tr")[1]?.textContent).toContain("3");
    expect(container.querySelectorAll("tbody tr")[1]?.textContent).toContain("4");
  });

  it("pads short rows with empty cells aligned to header count", () => {
    const { container } = mount(<TableView headers={["A", "B", "C"]} rows={[["1"]]} />);
    const cells = container.querySelectorAll("tbody td");
    expect(cells.length).toBe(3);
    expect(cells[0]?.textContent).toBe("1");
  });

  it("applies sticky modifier when stickyHeader", () => {
    const { container } = mount(<TableView headers={["A"]} rows={[["1"]]} stickyHeader />);
    expect(container.querySelector("table")?.className).toContain("ds-table--sticky");
  });

  it("renders visually-hidden caption when caption provided", () => {
    const { container } = mount(<TableView headers={["A"]} rows={[["1"]]} caption="Test data" />);
    expect(container.querySelector("caption")?.textContent).toBe("Test data");
  });

  it("uses rowKey when supplied", () => {
    const { container } = mount(
      <TableView headers={["A"]} rows={[["x"], ["y"]]} rowKey={(_row, index) => `row-${index}`} />,
    );
    expect(container.querySelectorAll("tbody tr").length).toBe(2);
  });
});
