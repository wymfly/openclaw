import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const GUARDED_FILES = [
  "ChannelDetail.tsx",
  "ChannelAccessTab.tsx",
  "ChannelSettingsTab.tsx",
  "CapabilityActionBar.tsx",
];

const FORBIDDEN_PATTERNS = [
  /channelId\s*===\s*["'][\w-]+["']/,
  /channelId\s*!==\s*["'][\w-]+["']/,
  /channel\.id\s*===\s*["'][\w-]+["']/,
  /channel\.id\s*!==\s*["'][\w-]+["']/,
  /switch\s*\(\s*channelId\s*\)/,
];

describe("channel detail hardcoded channel id guard", () => {
  for (const file of GUARDED_FILES) {
    test(`${file} has no hardcoded channel id comparisons`, () => {
      const source = readFileSync(join(here, file), "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source, `${file} violates ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});
