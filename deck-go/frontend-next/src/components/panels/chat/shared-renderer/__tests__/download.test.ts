import { describe, it, expect } from "vitest";
import { buildDownloadFilename, EXTENSION_MAP, MIME_MAP } from "../download";

describe("download", () => {
  it("uses source.fileName when available", () => {
    expect(
      buildDownloadFilename({
        id: "1",
        title: "test",
        language: "html",
        content: "",
        source: { fileName: "page.html" },
      }),
    ).toBe("page.html");
  });

  it("falls back to artifact.{ext} when no source.fileName", () => {
    expect(
      buildDownloadFilename({ id: "1", title: "artifactJson", language: "json", content: "" }),
    ).toBe("artifact.json");
  });

  it("falls back to artifact.{ext} for any title (title is never used as filename)", () => {
    expect(buildDownloadFilename({ id: "1", title: "", language: "csv", content: "" })).toBe(
      "artifact.csv",
    );
  });

  it("has entries for all languages in EXTENSION_MAP", () => {
    const languages = [
      "html",
      "svg",
      "mermaid",
      "json",
      "csv",
      "markdown",
      "code",
      "text",
      "image",
    ];
    for (const lang of languages) {
      expect(EXTENSION_MAP).toHaveProperty(lang);
      expect(MIME_MAP).toHaveProperty(lang);
    }
  });

  // --- Functional test plan P4-P8: per-type extension and MIME coverage ---

  it("P4: HTML → .html extension, text/html MIME", () => {
    expect(EXTENSION_MAP.html).toBe("html");
    expect(MIME_MAP.html).toBe("text/html");
    expect(buildDownloadFilename({ id: "1", title: "HTML", language: "html", content: "" })).toBe(
      "artifact.html",
    );
  });

  it("P5: JSON → .json extension, application/json MIME", () => {
    expect(EXTENSION_MAP.json).toBe("json");
    expect(MIME_MAP.json).toBe("application/json");
    expect(
      buildDownloadFilename({ id: "1", title: "artifactJson", language: "json", content: "" }),
    ).toBe("artifact.json");
  });

  it("P6: CSV → .csv extension, text/csv MIME", () => {
    expect(EXTENSION_MAP.csv).toBe("csv");
    expect(MIME_MAP.csv).toBe("text/csv");
  });

  it("P7: Markdown → .md extension, text/markdown MIME", () => {
    expect(EXTENSION_MAP.markdown).toBe("md");
    expect(MIME_MAP.markdown).toBe("text/markdown");
  });

  it("P8: Code → .txt extension, text/plain MIME", () => {
    expect(EXTENSION_MAP.code).toBe("txt");
    expect(MIME_MAP.code).toBe("text/plain");
  });

  it("P9: Image → .png extension, image/png MIME", () => {
    expect(EXTENSION_MAP.image).toBe("png");
    expect(MIME_MAP.image).toBe("image/png");
  });

  it("SVG → .svg extension, image/svg+xml MIME", () => {
    expect(EXTENSION_MAP.svg).toBe("svg");
    expect(MIME_MAP.svg).toBe("image/svg+xml");
  });

  it("Mermaid → .mmd extension, text/plain MIME", () => {
    expect(EXTENSION_MAP.mermaid).toBe("mmd");
    expect(MIME_MAP.mermaid).toBe("text/plain");
  });

  it("P10: source.fileName takes priority over generated name", () => {
    expect(
      buildDownloadFilename({
        id: "1",
        title: "Code",
        language: "code",
        content: "",
        source: { fileName: "main.py", filePath: "/app/main.py" },
      }),
    ).toBe("main.py");
  });
});
