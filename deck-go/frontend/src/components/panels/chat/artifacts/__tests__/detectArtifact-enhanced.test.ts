import { describe, expect, it } from "vitest";
import { detectArtifact } from "../detectArtifact";

describe("detectArtifact enhanced", () => {
  it("detects HTML and extracts titles", () => {
    const html = "<!DOCTYPE html><html><head><title>Report</title></head><body>hello</body></html>";
    expect(detectArtifact(html)).toMatchObject({ language: "html", title: "Report" });
  });

  it("detects SVG", () => {
    expect(
      detectArtifact('<svg xmlns="http://www.w3.org/2000/svg" width="100"></svg>')?.language,
    ).toBe("svg");
  });

  it("detects JSON object content but ignores short JSON", () => {
    expect(
      detectArtifact(JSON.stringify({ name: "test", items: [1, 2, 3], nested: { ok: true } })),
    ).toMatchObject({ language: "json", title: "artifactJson" });
    expect(detectArtifact('{"a":1}')).toBeNull();
  });

  it("detects CSV with quoted commas", () => {
    const csv = 'name,city,note\nAlice,"New York, NY","comma"\nBob,"San Francisco, CA","ok"';
    expect(detectArtifact(csv)?.language).toBe("csv");
  });

  it("rejects inconsistent CSV", () => {
    expect(detectArtifact("a,b,c\n1,2\n3,4,5,6")).toBeNull();
  });

  it("detects Markdown heading and relaxed markdown", () => {
    expect(detectArtifact("# Title\n\nThis is a **bold** paragraph.")?.language).toBe("markdown");
    expect(
      detectArtifact(
        "This is a **bold** paragraph with [a link](https://example.com) and enough text.",
      )?.language,
    ).toBe("markdown");
  });

  it("detects code from tool context and file extension", () => {
    const result = detectArtifact('function hello() { return "world"; }', {
      toolName: "write_file",
      filePath: "/tmp/index.ts",
    });
    expect(result).toMatchObject({
      language: "code",
      codeLang: "ts",
      title: "index.ts",
      source: { fileName: "index.ts", filePath: "/tmp/index.ts" },
    });
  });

  it("does not detect code without tool context", () => {
    expect(detectArtifact('function hello() { return "world"; }')).toBeNull();
  });

  it("validates JSON even when the file extension is .json", () => {
    const result = detectArtifact("this is not json but long enough", {
      toolName: "write",
      filePath: "data.json",
    });
    expect(result?.language).not.toBe("json");
  });

  it("detects base64 image data URIs", () => {
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk";
    expect(detectArtifact(dataUri)).toMatchObject({ language: "image", codeLang: "png" });
  });

  it("detects mermaid code blocks", () => {
    const result = detectArtifact("```mermaid\ngraph TD\n  A-->B\n```");
    expect(result).toMatchObject({ language: "mermaid", title: "Diagram" });
    expect(result?.content).toContain("graph TD");
    expect(result?.content).not.toContain("```");
  });

  it("preserves extension-priority behavior for non-code artifacts", () => {
    expect(
      detectArtifact("plain markdown content that is long enough for artifact detection", {
        toolName: "read",
        filePath: "/docs/README.md",
      }),
    ).toMatchObject({ language: "markdown", title: "README.md" });
    expect(
      detectArtifact("some svg content that is long enough for artifact detection", {
        toolName: "write",
        filePath: "/tmp/diagram.svg",
      }),
    ).toMatchObject({ language: "svg", title: "diagram.svg" });
    expect(
      detectArtifact("some generic content that is long enough for artifact detection", {
        toolName: "write",
        filePath: "/tmp/output.html",
      }),
    ).toMatchObject({ language: "html", title: "output.html" });
  });

  it("preserves file-write fallbacks for rejected structured extensions", () => {
    expect(
      detectArtifact("header1,header2,header3", {
        toolName: "write",
        filePath: "/tmp/test.csv",
      }),
    ).toMatchObject({ language: "code", title: "test.csv", codeLang: "csv" });
    expect(
      detectArtifact("CC=gcc\nCFLAGS=-Wall -O2\n\nall: main.o\n\tcc main.o -o main", {
        toolName: "write",
        filePath: "/tmp/Makefile",
      }),
    ).toMatchObject({ language: "code", title: "Makefile" });
  });

  it("preserves image source context and jpeg subtype detection", () => {
    const jpegDataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJ";
    expect(detectArtifact(jpegDataUri)).toMatchObject({ language: "image", codeLang: "jpeg" });

    const pngDataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk";
    expect(
      detectArtifact(pngDataUri, { toolName: "read", filePath: "/tmp/screenshot.png" }),
    ).toMatchObject({
      language: "image",
      source: { toolName: "read", fileName: "screenshot.png", filePath: "/tmp/screenshot.png" },
    });
  });
});
