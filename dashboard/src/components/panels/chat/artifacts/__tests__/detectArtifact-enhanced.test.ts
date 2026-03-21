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

  it("detects Markdown", () => {
    const md = "# Title\n\nThis is a **bold** paragraph.\n\n- Item 1\n- Item 2";
    expect(detectArtifact(md)?.language).toBe("markdown");
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
    expect(detectArtifact(json)?.title).toBe("JSON");
  });

  it("sets correct title for CSV artifact", () => {
    const csv = "name,age,city\nAlice,28,Beijing\nBob,32,Shanghai\nCharlie,25,Shenzhen";
    expect(detectArtifact(csv)?.title).toBe("Table");
  });

  it("sets correct title for Markdown artifact", () => {
    const md = "# Title\n\nThis is a **bold** paragraph.\n\n- Item 1\n- Item 2";
    expect(detectArtifact(md)?.title).toBe("Document");
  });
});
