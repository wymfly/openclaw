export const behaviorManifestPath: string;
export const unitTimingManifestPath: string;
export const unitMemoryHotspotManifestPath: string;

export type TestRunnerManifestEntry = {
  file: string;
  reason: string;
};

export type TestRunnerBehavior = {
  base: {
    threadPinned: TestRunnerManifestEntry[];
  };
  channels: {
    isolated: TestRunnerManifestEntry[];
    isolatedPrefixes: string[];
  };
  extensions: {
    isolated: TestRunnerManifestEntry[];
  };
  unit: {
    isolated: TestRunnerManifestEntry[];
    threadPinned: TestRunnerManifestEntry[];
  };
};

export type UnitTimingManifest = {
  config: string;
  generatedAt: string;
  defaultDurationMs: number;
  files: Record<string, { durationMs: number; testCount?: number }>;
};

export type UnitMemoryHotspotManifest = {
  config: string;
  generatedAt: string;
  defaultMinDeltaKb: number;
  files: Record<string, { deltaKb: number; sources?: string[] }>;
};

export function loadTestRunnerBehavior(): TestRunnerBehavior;
export function loadUnitTimingManifest(): UnitTimingManifest;
export function loadUnitMemoryHotspotManifest(): UnitMemoryHotspotManifest;
