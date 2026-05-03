// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "../../atoms/__tests__/axe-helper";
import { render } from "../../atoms/__tests__/render-component";
import { SectionHeader } from "../SectionHeader";

describe("SectionHeader", () => {
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

  it("renders title as h2 for outline correctness", () => {
    const { container } = mount(<SectionHeader title="Identity" />);
    const heading = container.querySelector(".ds-section-header__title");
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe("Identity");
  });

  it("renders description below title when provided", () => {
    const { container } = mount(
      <SectionHeader title="Identity" description="Backend-supported fields." />,
    );
    expect(container.querySelector(".ds-section-header__description")?.textContent).toBe(
      "Backend-supported fields.",
    );
  });

  it("renders inline hint slot when provided", () => {
    const { container } = mount(<SectionHeader title="Skills" hint="3 of 8 enabled" />);
    expect(container.querySelector(".ds-section-header__hint")?.textContent).toBe("3 of 8 enabled");
  });

  it("renders actions slot right-aligned when provided", () => {
    const { container } = mount(<SectionHeader title="Skills" actions={<button>Save</button>} />);
    expect(container.querySelector(".ds-section-header__actions button")?.textContent).toBe("Save");
  });

  it("does not render hint or actions when not provided", () => {
    const { container } = mount(<SectionHeader title="bare" />);
    expect(container.querySelector(".ds-section-header__hint")).toBeNull();
    expect(container.querySelector(".ds-section-header__actions")).toBeNull();
  });

  it("optional id is set on the header element for hash anchoring", () => {
    const { container } = mount(<SectionHeader title="x" id="identity" />);
    expect(container.querySelector(".ds-section-header")?.id).toBe("identity");
  });

  it("passes axe", async () => {
    const { container } = mount(
      <SectionHeader
        title="Identity"
        description="Backend-supported fields."
        hint="hint"
        actions={<button>Save</button>}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
