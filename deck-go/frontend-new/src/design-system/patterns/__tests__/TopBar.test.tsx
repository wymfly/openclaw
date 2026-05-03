// @vitest-environment jsdom
import type { ReactElement } from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "../../atoms/__tests__/axe-helper";
import { render } from "../../atoms/__tests__/render-component";
import { TopBar } from "../TopBar";

describe("TopBar", () => {
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

  it("renders brand text inside a strong element", () => {
    const { container } = mount(<TopBar brand="OpenClaw Deck" />);
    const brand = container.querySelector(".ds-top-bar__brand");
    expect(brand?.querySelector("strong")?.textContent).toBe("OpenClaw Deck");
  });

  it("does not render a command button when onCommandPaletteOpen is omitted", () => {
    const { container } = mount(<TopBar brand="x" />);
    expect(container.querySelector(".ds-top-bar__command")).toBeNull();
  });

  it("renders command button with aria-keyshortcuts when onCommandPaletteOpen is provided", () => {
    const onOpen = vi.fn();
    const { container } = mount(<TopBar brand="x" onCommandPaletteOpen={onOpen} />);
    const button = container.querySelector<HTMLButtonElement>(".ds-top-bar__command");
    expect(button).toBeTruthy();
    expect(button?.getAttribute("aria-keyshortcuts")).toBe("Meta+K Control+K");
    act(() => {
      button?.click();
    });
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("renders actions slot when provided", () => {
    const { container } = mount(<TopBar brand="x" actions={<button>New</button>} />);
    expect(container.querySelector(".ds-top-bar__actions button")?.textContent).toBe("New");
  });

  it("passes axe", async () => {
    const { container } = mount(<TopBar brand="OpenClaw Deck" onCommandPaletteOpen={() => {}} />);
    await expectNoAxeViolations(container);
  });
});
