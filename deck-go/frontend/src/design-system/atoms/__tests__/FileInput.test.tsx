// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { FileInput } from "../FileInput";
import { render } from "./render-component";

describe("FileInput", () => {
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

  it("renders label with provided children", () => {
    const { container } = mount(<FileInput>Upload</FileInput>);
    expect(container.querySelector(".ds-file-input")?.tagName).toBe("LABEL");
    expect(container.querySelector(".ds-file-input__label")?.textContent).toBe("Upload");
  });

  it("native file input is hidden by default (hideStatus=true)", () => {
    const { container } = mount(<FileInput>x</FileInput>);
    expect(container.querySelector(".ds-file-input__visually-hidden")).not.toBeNull();
    expect(container.querySelector(".ds-file-input__native")).toBeNull();
  });

  it("hideStatus=false shows native input", () => {
    const { container } = mount(<FileInput hideStatus={false}>x</FileInput>);
    expect(container.querySelector(".ds-file-input__native")).not.toBeNull();
  });

  it("forwards multiple/accept/disabled to underlying input", () => {
    const { container } = mount(
      <FileInput multiple accept="image/*" disabled>
        x
      </FileInput>,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe("image/*");
    expect(input.disabled).toBe(true);
    expect(container.querySelector(".ds-file-input")?.className).toContain(
      "ds-file-input--disabled",
    );
  });
});
