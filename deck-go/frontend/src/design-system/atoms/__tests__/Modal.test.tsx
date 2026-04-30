// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "../Modal";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Modal", () => {
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
      <Modal open={false} onClose={() => {}} aria-label="x">
        body
      </Modal>,
    );
    expect(container.querySelector(".ds-modal")).toBeNull();
  });

  it("renders dialog with role=dialog, aria-modal=true and aria-label when open", () => {
    const { container } = mount(
      <Modal open onClose={() => {}} aria-label="Approve tool">
        body
      </Modal>,
    );
    const dialog = container.querySelector(".ds-modal");
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-label")).toBe("Approve tool");
  });

  it("size=md and size=lg apply width modifiers", () => {
    const { container, rerender } = mount(
      <Modal open onClose={() => {}} aria-label="x" size="md">
        body
      </Modal>,
    );
    expect(container.querySelector(".ds-modal")?.className).toContain("ds-modal--md");
    rerender(
      <Modal open onClose={() => {}} aria-label="x" size="lg">
        body
      </Modal>,
    );
    expect(container.querySelector(".ds-modal")?.className).toContain("ds-modal--lg");
  });

  it("scrim click closes by default", () => {
    const onClose = vi.fn();
    const { container } = mount(
      <Modal open onClose={onClose} aria-label="x">
        body
      </Modal>,
    );
    const scrim = container.querySelector(".ds-modal-scrim") as HTMLDivElement;
    act(() => scrim.click());
    expect(onClose).toHaveBeenCalled();
  });

  it("dismissOnScrimClick=false ignores scrim click", () => {
    const onClose = vi.fn();
    const { container } = mount(
      <Modal open onClose={onClose} aria-label="x" dismissOnScrimClick={false}>
        body
      </Modal>,
    );
    const scrim = container.querySelector(".ds-modal-scrim") as HTMLDivElement;
    act(() => scrim.click());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Escape key closes modal", () => {
    const onClose = vi.fn();
    mount(
      <Modal open onClose={onClose} aria-label="x">
        body
      </Modal>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking inside dialog does not close", () => {
    const onClose = vi.fn();
    const { container } = mount(
      <Modal open onClose={onClose} aria-label="x">
        <button data-testid="inside">go</button>
      </Modal>,
    );
    const inside = container.querySelector('[data-testid="inside"]') as HTMLButtonElement;
    act(() => inside.click());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses aria-labelledby + aria-describedby when provided", () => {
    const { container } = mount(
      <Modal open onClose={() => {}} aria-labelledby="h" aria-describedby="d">
        <h3 id="h">Title</h3>
        <p id="d">Describe</p>
      </Modal>,
    );
    const dialog = container.querySelector(".ds-modal");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("h");
    expect(dialog?.getAttribute("aria-describedby")).toBe("d");
    expect(dialog?.getAttribute("aria-label")).toBeNull();
  });

  it("locks body scroll while open", () => {
    expect(document.body.style.overflow).toBe("");
    const { unmount } = render(
      <Modal open onClose={() => {}} aria-label="x">
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("has no axe violations", async () => {
    const { container } = mount(
      <Modal open onClose={() => {}} aria-label="Approve tool">
        <p>Body content</p>
      </Modal>,
    );
    await expectNoAxeViolations(container);
  });
});
