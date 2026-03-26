import { describe, it, expect } from "vitest";
import { detectArtifact } from "../detectArtifact";

describe("detectArtifact enhanced", () => {
  it("detects HTML", () => {
    expect(detectArtifact("<!DOCTYPE html><html><body>hi</body></html>")?.language).toBe("html");
  });

  it("detects SVG", () => {
    expect(
      detectArtifact('<svg xmlns="http://www.w3.org/2000/svg" width="100"></svg>')?.language,
    ).toBe("svg");
  });

  it("detects JSON object", () => {
    const json = JSON.stringify({ name: "test", items: [1, 2, 3], nested: { a: 1 } });
    expect(detectArtifact(json)?.language).toBe("json");
  });

  it("ignores short JSON", () => {
    expect(detectArtifact('{"a":1}')).toBeNull();
  });

  it("detects CSV", () => {
    const csv = "name,age,city\nAlice,28,Beijing\nBob,32,Shanghai\nCharlie,25,Shenzhen";
    expect(detectArtifact(csv)?.language).toBe("csv");
  });

  it("detects CSV with quoted fields containing commas (B7)", () => {
    const csv =
      'name,city,note\nAlice,"New York, NY","has a comma"\nBob,"San Francisco, CA","also commas"';
    expect(detectArtifact(csv)?.language).toBe("csv");
  });

  it("rejects inconsistent CSV when quotes are mishandled", () => {
    // 3 fields in header, but varying raw comma counts without quote awareness
    const notCsv = "a,b,c\n1,2\n3,4,5,6";
    expect(detectArtifact(notCsv)).toBeNull(); // too few lines or inconsistent fields
  });

  it("detects Markdown with heading", () => {
    const md = "# Title\n\nThis is a **bold** paragraph.\n\n- Item 1\n- Item 2";
    expect(detectArtifact(md)?.language).toBe("markdown");
  });

  it("detects Markdown with multiple patterns but no heading (B2)", () => {
    const md =
      "This is a **bold** paragraph with [a link](https://example.com) and more text to pad out the length beyond eighty characters for detection.";
    expect(detectArtifact(md)?.language).toBe("markdown");
  });

  it("detects text with one markdown pattern when long enough (relaxed threshold)", () => {
    const prose =
      "This is some normal text that happens to contain **one bold phrase** but nothing else that looks like markdown formatting at all in this line.";
    expect(detectArtifact(prose)?.language).toBe("markdown");
  });

  it("returns null for short text", () => {
    expect(detectArtifact("short")).toBeNull();
  });

  it("detects code with tool context", () => {
    const code = 'function hello() {\n  console.log("hello world");\n  return true;\n}';
    const result = detectArtifact(code, { toolName: "write_file", filePath: "index.ts" });
    expect(result?.language).toBe("code");
    expect(result?.codeLang).toBe("ts");
    expect(result?.source?.toolName).toBe("write_file");
    expect(result?.source?.fileName).toBe("index.ts");
  });

  it("does not detect code without tool context", () => {
    const code = 'function hello() {\n  console.log("hello world");\n  return true;\n}';
    expect(detectArtifact(code)).toBeNull();
  });

  it("sets correct title for JSON artifact", () => {
    const json = JSON.stringify({ name: "test", items: [1, 2, 3], nested: { a: 1 } });
    expect(detectArtifact(json)?.title).toBe("artifactJson");
  });

  it("sets correct title for CSV artifact", () => {
    const csv = "name,age,city\nAlice,28,Beijing\nBob,32,Shanghai\nCharlie,25,Shenzhen";
    expect(detectArtifact(csv)?.title).toBe("artifactCsv");
  });

  it("sets correct title for Markdown artifact", () => {
    const md = "# Title\n\nThis is a **bold** paragraph.\n\n- Item 1\n- Item 2";
    expect(detectArtifact(md)?.title).toBe("artifactMarkdown");
  });

  // --- Extension priority tests ---

  it("detects language from .html extension", () => {
    const result = detectArtifact(
      "some generic content that is long enough to pass the minimum length check",
      {
        toolName: "write",
        filePath: "/tmp/output.html",
      },
    );
    expect(result?.language).toBe("html");
    expect(result?.source?.filePath).toBe("/tmp/output.html");
  });

  it("detects code from .py extension", () => {
    const result = detectArtifact("def hello():\n    print('hello world')\n    return True", {
      toolName: "write",
      filePath: "script.py",
    });
    expect(result?.language).toBe("code");
    expect(result?.codeLang).toBe("py");
  });

  it("validates JSON even with .json extension", () => {
    const result = detectArtifact("this is not json but long enough to pass twenty chars", {
      toolName: "write",
      filePath: "data.json",
    });
    expect(result?.language).not.toBe("json");
  });

  it("uses extension title from filePath", () => {
    const result = detectArtifact("body { color: red; }\n.container { display: flex; }", {
      toolName: "write",
      filePath: "/app/styles/main.css",
    });
    expect(result?.title).toBe("main.css");
  });

  // --- Image detection tests ---

  it("detects base64 PNG image", () => {
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk";
    const result = detectArtifact(dataUri);
    expect(result?.language).toBe("image");
    expect(result?.codeLang).toBe("png");
    expect(result?.content).toBe(dataUri);
  });

  it("detects base64 JPEG image", () => {
    const dataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJ";
    const result = detectArtifact(dataUri);
    expect(result?.language).toBe("image");
    expect(result?.codeLang).toBe("jpeg");
  });

  // --- Relaxed markdown tests ---

  it("detects markdown with single bold pattern and 40+ chars", () => {
    const md = "This text has **one bold section** and is long enough to be useful content.";
    expect(detectArtifact(md)?.language).toBe("markdown");
  });

  // --- Functional test plan gap coverage (D4-D24) ---

  // D4: .json extension but invalid JSON content → should NOT detect as json
  // (already covered by "validates JSON even with .json extension")

  // D5: .csv extension but only 1 line → should NOT detect as csv
  it("csv extension with single-line content falls through", () => {
    const result = detectArtifact("header1,header2,header3", {
      toolName: "write",
      filePath: "/tmp/test.csv",
    });
    // Not enough lines for CSV; falls through to write-tool fallback → code
    expect(result?.language).not.toBe("csv");
  });

  // D6: no extension file with write tool → code fallback
  it("no extension file with write tool detected as code", () => {
    const result = detectArtifact("CC=gcc\nCFLAGS=-Wall -O2\n\nall: main.o\n\tcc main.o -o main", {
      toolName: "write",
      filePath: "/tmp/Makefile",
    });
    expect(result?.language).toBe("code");
    expect(result?.source?.fileName).toBe("Makefile");
  });

  // D7: .svg extension
  it("detects svg from .svg extension", () => {
    const result = detectArtifact("some svg content that is long enough to pass minimum", {
      toolName: "write",
      filePath: "/tmp/diagram.svg",
    });
    expect(result?.language).toBe("svg");
    expect(result?.title).toBe("diagram.svg");
  });

  // D9/D10: base64 PNG/JPEG detection (already covered above)

  // D11: non-base64 image content → should NOT detect as image
  it("plain text is not detected as image", () => {
    const text = "This is not an image, it is just regular text content that happens to be long.";
    const result = detectArtifact(text);
    expect(result?.language).not.toBe("image");
  });

  // D13: SVG content detection without extension (already covered by "detects SVG")

  // D14: Mermaid detection
  it("detects mermaid code block", () => {
    const content = "Here is a diagram:\n```mermaid\ngraph TD\n  A-->B\n  B-->C\n```\nEnd.";
    const result = detectArtifact(content);
    expect(result?.language).toBe("mermaid");
    expect(result?.title).toBe("Diagram");
    // Content should be the inner mermaid code, not the full block
    expect(result?.content).toContain("graph TD");
    expect(result?.content).not.toContain("```");
  });

  // D15: JSON detection (>40 chars, valid object) — already covered

  // D16: CSV detection (≥3 lines, consistent columns) — already covered

  // D17: Markdown heading detection — already covered

  // D18: Markdown relaxed detection — already covered

  // D19: Code detection via write tool — already covered

  // D20: Short content (<20 chars) → null
  it("returns null for content under 20 characters", () => {
    expect(detectArtifact("too short")).toBeNull();
    expect(detectArtifact("exactly19characters")).toBeNull();
    // 20+ chars still null if content doesn't match any heuristic
    expect(detectArtifact("twenty characters!!X")).toBeNull();
  });

  // D21: Error results are handled by ToolResultCard (isError check), not detectArtifact itself.
  // detectArtifact has no isError parameter — tested at component level.

  // D23: No filePath → i18n key title for content-detected types
  it("JSON without filePath uses i18n key title", () => {
    const json = JSON.stringify({ name: "test", items: [1, 2, 3], nested: { a: 1 } });
    const result = detectArtifact(json);
    expect(result?.title).toBe("artifactJson");
    expect(result?.source).toBeUndefined();
  });

  // D24: HTML with <title> tag → extract title
  it("HTML title extracted from <title> tag", () => {
    const html = '<!DOCTYPE html><html><head><title>My Custom Page</title></head><body><p>Content here</p></body></html>';
    const result = detectArtifact(html);
    expect(result?.language).toBe("html");
    expect(result?.title).toBe("My Custom Page");
  });

  // Additional: image detection with source context
  it("image detection preserves source context", () => {
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk";
    const result = detectArtifact(dataUri, { toolName: "read", filePath: "/tmp/screenshot.png" });
    expect(result?.language).toBe("image");
    expect(result?.source?.toolName).toBe("read");
    expect(result?.source?.filePath).toBe("/tmp/screenshot.png");
  });

  // Additional: .md extension detection
  it("detects markdown from .md extension", () => {
    const result = detectArtifact(
      "Some plain content that does not look like markdown formatting at all",
      { toolName: "read", filePath: "/docs/README.md" },
    );
    expect(result?.language).toBe("markdown");
    expect(result?.title).toBe("README.md");
  });

  // Additional: .yml extension detected as code
  it("detects yaml from .yml extension as code", () => {
    const result = detectArtifact("name: test\nversion: 1.0\ndependencies:\n  - foo\n  - bar", {
      toolName: "read",
      filePath: "/app/config.yml",
    });
    expect(result?.language).toBe("code");
    expect(result?.codeLang).toBe("yml");
  });
});
