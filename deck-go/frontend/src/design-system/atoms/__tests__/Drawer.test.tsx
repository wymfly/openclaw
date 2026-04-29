// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Drawer } from "../Drawer";
import { render } from "./render-component";

describe("Drawer", () => {
  let cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
    cleanups = [];
  });

  function mount(node: Parameters<typeof render>[0]) {
    const result = render(node);
    cleanups.push(result.unmount);
    return result;
  }

  it("renders nothing when open=false", () => {
    const { container } = mount(
      <Drawer open={false} onClose={() => {}} aria-label="x">
        body
      </Drawer>,
    );
    expect(container.querySelector(".ds-drawer")).toBeNull();
  });

  it("renders dialog with role=dialog and aria-label when open", () => {
    const { container } = mount(
      <Drawer open onClose={() => {}} aria-label="Artifact panel">
        body
      </Drawer>,
    );
    const dialog = container.querySelector(".ds-drawer");
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-label")).toBe("Artifact panel");
  });

  it("respects width prop", () => {
    const { container } = mount(
      <Drawer open onClose={() => {}} aria-label="x" width={420}>
        body
      </Drawer>,
    );
    expect((container.querySelector(".ds-drawer") as HTMLElement).style.width).toBe("420px");
  });

  it("side=left applies left modifier", () => {
    const { container } = mount(
      <Drawer open onClose={() => {}} side="left" aria-label="x">
        body
      </Drawer>,
    );
    expect(container.querySelector(".ds-drawer")?.className).toContain("ds-drawer--left");
  });

  it("Escape key closes drawer", () => {
    const onClose = vi.fn();
    mount(
      <Drawer open onClose={onClose} aria-label="x">
        body
      </Drawer>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("scrim=true wraps with scrim and click closes", () => {
    const onClose = vi.fn();
    const { container } = mount(
      <Drawer open onClose={onClose} aria-label="x" scrim>
        body
      </Drawer>,
    );
    const scrim = container.querySelector(".ds-drawer-scrim") as HTMLDivElement;
    expect(scrim).not.toBeNull();
    act(() => scrim.click());
    expect(onClose).toHaveBeenCalled();
    // aria-modal on the dialog when scrim
    expect(container.querySelector(".ds-drawer")?.getAttribute("aria-modal")).toBe("true");
  });

  it("scrim=false omits scrim wrapper and aria-modal", () => {
    const { container } = mount(
      <Drawer open onClose={() => {}} aria-label="x">
        body
      </Drawer>,
    );
    expect(container.querySelector(".ds-drawer-scrim")).toBeNull();
    expect(container.querySelector(".ds-drawer")?.getAttribute("aria-modal")).toBeNull();
  });

  it("uses aria-labelledby instead of aria-label when provided", () => {
    const { container } = mount(
      <Drawer open onClose={() => {}} aria-labelledby="dlg-h">
        <h3 id="dlg-h">Title</h3>
      </Drawer>,
    );
    const dialog = container.querySelector(".ds-drawer");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("dlg-h");
    expect(dialog?.getAttribute("aria-label")).toBeNull();
  });
});
