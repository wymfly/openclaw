import { readFile } from "node:fs/promises";
import path from "node:path";

import { minimatch } from "minimatch";
import YAML from "yaml";

import type { ClosureProjectConfig, VerificationStatus } from "./types.js";

const DEFAULT_CONFIG: ClosureProjectConfig = {
  blockingStatuses: ["pending", "blocked", "spec-fix-required"],
  planGlobs: [],
  verificationFileName: "verification.yaml",
};

export async function loadClosureConfig(params: {
  configPath?: string;
  rootDir: string;
}): Promise<ClosureProjectConfig> {
  const configPath = params.configPath
    ? path.resolve(params.rootDir, params.configPath)
    : path.join(params.rootDir, ".openspec-closure.yaml");
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = (YAML.parse(raw) ?? {}) as Partial<ClosureProjectConfig>;
    return {
      blockingStatuses: validateStatuses(parsed.blockingStatuses ?? DEFAULT_CONFIG.blockingStatuses),
      planGlobs: validatePlanGlobs(parsed.planGlobs ?? DEFAULT_CONFIG.planGlobs),
      verificationFileName: validateVerificationFileName(
        parsed.verificationFileName ?? DEFAULT_CONFIG.verificationFileName,
      ),
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }
}

export async function resolvePlanFiles(params: {
  rootDir: string;
  planGlobs: string[];
}): Promise<string[]> {
  if (params.planGlobs.length === 0) {
    return [];
  }
  const files = await walkFiles(params.rootDir);
  return files
    .filter((filePath) => {
      const relative = path.relative(params.rootDir, filePath).replace(/\\/gu, "/");
      return params.planGlobs.some((pattern) => minimatch(relative, pattern, { dot: true }));
    })
    .sort();
}

export function resolveVerificationPath(params: {
  changeName: string;
  rootDir: string;
  verificationFileName: string;
}): string {
  return path.join(params.rootDir, "openspec", "changes", params.changeName, params.verificationFileName);
}

async function walkFiles(rootDir: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const results: string[] = [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const nestedFiles = await walkFiles(fullPath);
      for (const filePath of nestedFiles) {
        results.push(filePath);
      }
      continue;
    }
    if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function validateStatuses(statuses: VerificationStatus[]): VerificationStatus[] {
  const allowed = new Set<VerificationStatus>(["pending", "verified", "blocked", "spec-fix-required"]);
  for (const status of statuses) {
    if (!allowed.has(status)) {
      throw new Error(`Unsupported blocking status in config: ${status}`);
    }
  }
  return [...statuses];
}

function validatePlanGlobs(planGlobs: string[]): string[] {
  if (!Array.isArray(planGlobs) || planGlobs.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new Error("planGlobs must be a string array");
  }
  return [...planGlobs];
}

function validateVerificationFileName(fileName: string): string {
  if (!fileName || typeof fileName !== "string") {
    throw new Error("verificationFileName must be a non-empty string");
  }
  return fileName;
}
