// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as icons from "../index";

const barrelPath = resolve(process.cwd(), "src/design-system/icons/index.ts");
const readmePath = resolve(process.cwd(), "src/design-system/icons/README.md");

describe("design-system/icons barrel", () => {
  it("exports only named icons (no wildcard re-export)", () => {
    const source = readFileSync(barrelPath, "utf8");
    expect(source).not.toMatch(/export\s+\*\s+from\s+["']lucide-react["']/);
  });

  it("each Icon* export is a callable component (forwardRef object)", () => {
    const exports = Object.entries(icons).filter(([name]) => name.startsWith("Icon"));
    expect(exports.length).toBeGreaterThanOrEqual(20);
    for (const [name, value] of exports) {
      expect(value, `${name} should be a non-null component`).toBeTruthy();
      // lucide v1 icons are forwardRef objects with a `render` function
      const isComponent =
        typeof value === "function" ||
        (typeof value === "object" &&
          value !== null &&
          typeof (value as { render?: unknown }).render === "function");
      expect(isComponent, `${name} should be a React component`).toBe(true);
    }
  });

  it("README mapping table covers every Icon* export", () => {
    const readme = readFileSync(readmePath, "utf8");
    const exports = Object.keys(icons).filter((name) => name.startsWith("Icon"));
    for (const name of exports) {
      // README has rows like "| `IconAgent` | `User` | ... |"
      expect(readme, `README missing row for ${name}`).toContain(`\`${name}\``);
    }
  });

  it("uses individual lucide-react re-exports (not bulk star)", () => {
    const source = readFileSync(barrelPath, "utf8");
    // Each lucide re-export line should be `export { X as IconY } from "lucide-react";`
    const reExportLines = source.match(/export\s+\{[^}]+\}\s+from\s+["']lucide-react["']/g) ?? [];
    expect(reExportLines.length).toBeGreaterThanOrEqual(20);
    for (const line of reExportLines) {
      // Each line must contain `as Icon...`
      expect(line, `re-export line lacks semantic alias: ${line}`).toMatch(/as\s+Icon/);
    }
  });
});
