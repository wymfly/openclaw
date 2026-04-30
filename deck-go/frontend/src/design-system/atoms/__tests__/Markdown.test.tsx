// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Markdown } from "../Markdown";
import { expectNoAxeViolations } from "./axe-helper";
import { render } from "./render-component";

describe("Markdown", () => {
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

  it("renders ds-md wrapper with mode data attribute", () => {
    const { container } = mount(<Markdown content="hello" mode="streaming" />);
    const wrap = container.querySelector(".ds-md") as HTMLElement;
    expect(wrap).not.toBeNull();
    expect(wrap.getAttribute("data-markdown-mode")).toBe("streaming");
  });

  it("renders paragraph", () => {
    const { container } = mount(<Markdown content="hello world" />);
    expect(container.querySelector(".ds-md p")?.textContent).toBe("hello world");
  });

  it("renders heading levels", () => {
    const { container } = mount(<Markdown content={"# H1\n## H2\n### H3"} />);
    expect(container.querySelector("h1")?.textContent).toBe("H1");
    expect(container.querySelector("h2")?.textContent).toBe("H2");
    expect(container.querySelector("h3")?.textContent).toBe("H3");
  });

  it("renders unordered and ordered lists", () => {
    const { container } = mount(<Markdown content={"- a\n- b\n\n1. one\n2. two"} />);
    expect(container.querySelectorAll("ul li").length).toBe(2);
    expect(container.querySelectorAll("ol li").length).toBe(2);
  });

  it("renders fenced code with language attr", () => {
    const { container } = mount(<Markdown content={"```ts\nconst x = 1\n```"} />);
    const pre = container.querySelector("pre");
    expect(pre?.getAttribute("data-language")).toBe("ts");
    expect(pre?.querySelector("code")?.textContent).toBe("const x = 1");
  });

  it("renders inline code, strong, em, link", () => {
    const { container } = mount(
      <Markdown content="`x` and **bold** and *em* and [a](https://example.com)" />,
    );
    expect(container.querySelector("code")?.textContent).toBe("x");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("em");
    const a = container.querySelector("a") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("https://example.com");
    expect(a.textContent).toBe("a");
  });

  it("strips unsafe javascript: URLs", () => {
    const { container } = mount(<Markdown content="[x](javascript:alert(1))" />);
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders blockquote and table", () => {
    const md = "> quoted\n\n| h1 | h2 |\n|---|---|\n| a | b |";
    const { container } = mount(<Markdown content={md} />);
    expect(container.querySelector("blockquote")?.textContent).toContain("quoted");
    const ths = container.querySelectorAll("th");
    expect(ths[0]?.textContent).toBe("h1");
    expect(container.querySelectorAll("tbody td").length).toBe(2);
  });

  it("renders horizontal rule", () => {
    const { container } = mount(<Markdown content="---" />);
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = mount(<Markdown content="hello world" />);
    await expectNoAxeViolations(container);
  });
});
