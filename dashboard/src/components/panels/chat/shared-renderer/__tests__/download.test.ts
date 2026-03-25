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
    expect(
      buildDownloadFilename({ id: "1", title: "", language: "csv", content: "" }),
    ).toBe("artifact.csv");
  });

  it("has entries for all languages in EXTENSION_MAP", () => {
    const languages = ["html", "svg", "mermaid", "json", "csv", "markdown", "code", "text", "image"];
    for (const lang of languages) {
      expect(EXTENSION_MAP).toHaveProperty(lang);
      expect(MIME_MAP).toHaveProperty(lang);
    }
  });
});
