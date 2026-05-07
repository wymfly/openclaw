import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = join(process.cwd(), "src");
const loadedFontWeights = new Set(["400", "500", "600", "700"]);

function collectCssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectCssFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".css") ? [path] : [];
  });
}

describe("design system typography", () => {
  it("uses only loaded static font weights in authored CSS", () => {
    const violations = collectCssFiles(srcDir).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return Array.from(source.matchAll(/font-weight:\s*(\d+)\b/g))
        .filter((match) => !loadedFontWeights.has(match[1] ?? ""))
        .map((match) => `${relative(srcDir, file)}:${match.index ?? 0}: ${match[0]}`);
    });

    expect(violations).toEqual([]);
  });
});
