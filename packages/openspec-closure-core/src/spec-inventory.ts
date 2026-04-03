import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ScenarioInventoryEntry, ScenarioSection } from "./types.js";

const SECTION_PATTERN = /^## (ADDED|MODIFIED) Requirements$/gm;
const REQUIREMENT_PATTERN = /^### Requirement: (.+)$/gm;
const SCENARIO_PATTERN = /^#### Scenario: (.+)$/gm;
const SCENARIO_ID_PATTERN = /^- \*\*scenario_id\*\*:\s*`?([^`\r\n]+)`?\s*$/im;

function sectionRanges(source: string): Array<{ section: ScenarioSection; start: number; end: number }> {
  const ranges: Array<{ section: ScenarioSection; start: number; end: number }> = [];
  const matches = [...source.matchAll(SECTION_PATTERN)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const section = (match[1] ?? "").trim() as ScenarioSection;
    const start = match.index ?? 0;
    const next = matches[index + 1];
    const end = next?.index ?? source.length;
    ranges.push({ section, start, end });
  }
  return ranges;
}

function requirementRanges(sectionSource: string): Array<{ title: string; start: number; end: number }> {
  const ranges: Array<{ title: string; start: number; end: number }> = [];
  const matches = [...sectionSource.matchAll(REQUIREMENT_PATTERN)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = (match[1] ?? "").trim();
    const start = match.index ?? 0;
    const next = matches[index + 1];
    const end = next?.index ?? sectionSource.length;
    ranges.push({ title, start, end });
  }
  return ranges;
}

function scenarioRanges(requirementSource: string): Array<{ title: string; start: number; end: number }> {
  const ranges: Array<{ title: string; start: number; end: number }> = [];
  const matches = [...requirementSource.matchAll(SCENARIO_PATTERN)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = (match[1] ?? "").trim();
    const start = match.index ?? 0;
    const next = matches[index + 1];
    const end = next?.index ?? requirementSource.length;
    ranges.push({ title, start, end });
  }
  return ranges;
}

function parseScenarioId(scenarioSource: string, context: string): string {
  const match = scenarioSource.match(SCENARIO_ID_PATTERN);
  const scenarioId = match?.[1]?.trim();
  if (!scenarioId) {
    throw new Error(`Missing scenario_id in ${context}`);
  }
  return scenarioId;
}

export async function collectScenarioInventory(changeDir: string): Promise<ScenarioInventoryEntry[]> {
  const changeName = path.basename(changeDir);
  const specsRoot = path.join(changeDir, "specs");
  const capabilities = await listCapabilities(specsRoot);
  const inventory: ScenarioInventoryEntry[] = [];

  for (const capability of capabilities) {
    const specPath = path.join(specsRoot, capability, "spec.md");
    const raw = await readFile(specPath, "utf8");
    const specRelPath = path.relative(changeDir, specPath);

    for (const sectionRange of sectionRanges(raw)) {
      const sectionSource = raw.slice(sectionRange.start, sectionRange.end);
      for (const requirementRange of requirementRanges(sectionSource)) {
        const requirementSource = sectionSource.slice(requirementRange.start, requirementRange.end);
        for (const scenarioRange of scenarioRanges(requirementSource)) {
          const scenarioSource = requirementSource.slice(scenarioRange.start, scenarioRange.end);
          const scenarioTitle = scenarioRange.title;
          const requirementTitle = requirementRange.title;
          const context = `${specRelPath} :: ${requirementTitle} :: ${scenarioTitle}`;
          inventory.push({
            capability,
            changeName,
            requirementTitle,
            scenarioId: parseScenarioId(scenarioSource, context),
            scenarioTitle,
            section: sectionRange.section,
            specPath: specRelPath,
          });
        }
      }
    }
  }

  return inventory;
}

async function listCapabilities(specsRoot: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(specsRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}
