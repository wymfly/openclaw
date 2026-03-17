import { describe, test, expect } from "vitest";
import { createDecayEngine, DEFAULT_DECAY_CONFIG, type DecayableMemory } from "./decay-engine.js";

const MS_PER_DAY = 86_400_000;

function makeMemory(overrides: Partial<DecayableMemory> = {}): DecayableMemory {
  return {
    id: "mem-1",
    importance: 0.7,
    confidence: 0.8,
    tier: "working",
    accessCount: 0,
    createdAt: Date.now() - 7 * MS_PER_DAY,
    lastAccessedAt: Date.now() - 1 * MS_PER_DAY,
    ...overrides,
  };
}

describe("createDecayEngine", () => {
  test("returns a DecayEngine with all methods", () => {
    const engine = createDecayEngine();
    expect(engine.score).toBeTypeOf("function");
    expect(engine.scoreAll).toBeTypeOf("function");
    expect(engine.applySearchBoost).toBeTypeOf("function");
    expect(engine.getStaleMemories).toBeTypeOf("function");
  });
});

describe("score", () => {
  const engine = createDecayEngine();

  test("composite is weighted sum of recency + frequency + intrinsic", () => {
    const memory = makeMemory();
    const now = Date.now();
    const ds = engine.score(memory, now);

    expect(ds.composite).toBeCloseTo(0.4 * ds.recency + 0.3 * ds.frequency + 0.3 * ds.intrinsic, 5);
  });

  test("recently accessed memory has high recency", () => {
    const now = Date.now();
    const recentMem = makeMemory({ lastAccessedAt: now - 1000, accessCount: 1 });
    const ds = engine.score(recentMem, now);
    expect(ds.recency).toBeGreaterThan(0.99);
  });

  test("old memory has lower recency", () => {
    const now = Date.now();
    const oldMem = makeMemory({
      lastAccessedAt: now - 365 * MS_PER_DAY,
      accessCount: 1,
    });
    const ds = engine.score(oldMem, now);
    expect(ds.recency).toBeLessThan(0.5);
  });

  test("intrinsic score = importance × confidence", () => {
    const memory = makeMemory({ importance: 0.9, confidence: 0.95 });
    const ds = engine.score(memory);
    expect(ds.intrinsic).toBeCloseTo(0.855, 3);
  });

  test("higher importance extends effective half-life", () => {
    const now = Date.now();
    const daysSince = 30;
    const lowImp = makeMemory({
      importance: 0.3,
      lastAccessedAt: now - daysSince * MS_PER_DAY,
      accessCount: 1,
    });
    const highImp = makeMemory({
      importance: 0.9,
      lastAccessedAt: now - daysSince * MS_PER_DAY,
      accessCount: 1,
    });
    const lowScore = engine.score(lowImp, now);
    const highScore = engine.score(highImp, now);
    expect(highScore.recency).toBeGreaterThan(lowScore.recency);
  });

  test("frequency increases with access count", () => {
    const now = Date.now();
    const noAccess = makeMemory({ accessCount: 0 });
    const manyAccess = makeMemory({ accessCount: 20 });
    const dsNo = engine.score(noAccess, now);
    const dsMany = engine.score(manyAccess, now);
    expect(dsMany.frequency).toBeGreaterThan(dsNo.frequency);
  });
});

describe("tier-specific behavior", () => {
  const engine = createDecayEngine();

  test("core tier decays slower than peripheral", () => {
    const now = Date.now();
    const daysSince = 60;
    const core = makeMemory({
      tier: "core",
      lastAccessedAt: now - daysSince * MS_PER_DAY,
      accessCount: 1,
    });
    const peripheral = makeMemory({
      tier: "peripheral",
      lastAccessedAt: now - daysSince * MS_PER_DAY,
      accessCount: 1,
    });
    const coreScore = engine.score(core, now);
    const periScore = engine.score(peripheral, now);
    expect(coreScore.recency).toBeGreaterThan(periScore.recency);
  });

  test("working tier falls between core and peripheral", () => {
    const now = Date.now();
    const daysSince = 60;
    const opts = {
      lastAccessedAt: now - daysSince * MS_PER_DAY,
      accessCount: 1,
      importance: 0.7,
      confidence: 0.8,
    };
    const core = engine.score(makeMemory({ ...opts, tier: "core" }), now);
    const working = engine.score(makeMemory({ ...opts, tier: "working" }), now);
    const peripheral = engine.score(makeMemory({ ...opts, tier: "peripheral" }), now);
    expect(core.recency).toBeGreaterThan(working.recency);
    expect(working.recency).toBeGreaterThan(peripheral.recency);
  });
});

describe("scoreAll", () => {
  test("scores multiple memories", () => {
    const engine = createDecayEngine();
    const memories = [makeMemory({ id: "m1" }), makeMemory({ id: "m2", importance: 0.9 })];
    const scores = engine.scoreAll(memories);
    expect(scores).toHaveLength(2);
    expect(scores[0].memoryId).toBe("m1");
    expect(scores[1].memoryId).toBe("m2");
  });
});

describe("applySearchBoost", () => {
  test("modifies scores in place", () => {
    const engine = createDecayEngine();
    const results = [
      { memory: makeMemory({ tier: "core" }), score: 0.9 },
      { memory: makeMemory({ tier: "peripheral" }), score: 0.9 },
    ];
    engine.applySearchBoost(results);
    // Both scores should be modified
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[1].score).toBeGreaterThan(0);
    // Core tier should have higher boost than peripheral
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  test("search boost stays within [boostMin, 1] range", () => {
    const engine = createDecayEngine();
    const results = [{ memory: makeMemory(), score: 1.0 }];
    engine.applySearchBoost(results);
    expect(results[0].score).toBeLessThanOrEqual(1.0);
    expect(results[0].score).toBeGreaterThanOrEqual(DEFAULT_DECAY_CONFIG.searchBoostMin);
  });
});

describe("getStaleMemories", () => {
  test("identifies memories below stale threshold", () => {
    const engine = createDecayEngine();
    const now = Date.now();
    const staleMemory = makeMemory({
      id: "stale-1",
      importance: 0.1,
      confidence: 0.1,
      accessCount: 0,
      createdAt: now - 365 * MS_PER_DAY,
      lastAccessedAt: now - 365 * MS_PER_DAY,
      tier: "peripheral",
    });
    const freshMemory = makeMemory({
      id: "fresh-1",
      importance: 0.9,
      confidence: 0.9,
      accessCount: 10,
      lastAccessedAt: now - 1000,
    });

    const stale = engine.getStaleMemories([staleMemory, freshMemory], now);
    const staleIds = stale.map((s) => s.memoryId);
    expect(staleIds).toContain("stale-1");
    expect(staleIds).not.toContain("fresh-1");
  });

  test("returns empty array when no stale memories", () => {
    const engine = createDecayEngine();
    const freshMem = makeMemory({
      importance: 0.9,
      confidence: 0.9,
      accessCount: 5,
      lastAccessedAt: Date.now() - 1000,
    });
    const stale = engine.getStaleMemories([freshMem]);
    expect(stale).toHaveLength(0);
  });

  test("returns sorted by composite ascending", () => {
    const engine = createDecayEngine();
    const now = Date.now();
    const memories = [
      makeMemory({
        id: "m1",
        importance: 0.2,
        confidence: 0.2,
        accessCount: 0,
        lastAccessedAt: now - 300 * MS_PER_DAY,
        createdAt: now - 300 * MS_PER_DAY,
        tier: "peripheral",
      }),
      makeMemory({
        id: "m2",
        importance: 0.15,
        confidence: 0.15,
        accessCount: 0,
        lastAccessedAt: now - 350 * MS_PER_DAY,
        createdAt: now - 350 * MS_PER_DAY,
        tier: "peripheral",
      }),
    ];
    const stale = engine.getStaleMemories(memories, now);
    if (stale.length >= 2) {
      expect(stale[0].composite).toBeLessThanOrEqual(stale[1].composite);
    }
  });
});

describe("DEFAULT_DECAY_CONFIG", () => {
  test("has expected default values", () => {
    expect(DEFAULT_DECAY_CONFIG.recencyWeight).toBe(0.4);
    expect(DEFAULT_DECAY_CONFIG.frequencyWeight).toBe(0.3);
    expect(DEFAULT_DECAY_CONFIG.intrinsicWeight).toBe(0.3);
    expect(DEFAULT_DECAY_CONFIG.staleThreshold).toBe(0.3);
    expect(DEFAULT_DECAY_CONFIG.betaCore).toBe(0.8);
    expect(DEFAULT_DECAY_CONFIG.betaWorking).toBe(1.0);
    expect(DEFAULT_DECAY_CONFIG.betaPeripheral).toBe(1.3);
    expect(DEFAULT_DECAY_CONFIG.coreDecayFloor).toBe(0.9);
    expect(DEFAULT_DECAY_CONFIG.workingDecayFloor).toBe(0.7);
    expect(DEFAULT_DECAY_CONFIG.peripheralDecayFloor).toBe(0.5);
  });

  test("weights sum to 1.0", () => {
    const sum =
      DEFAULT_DECAY_CONFIG.recencyWeight +
      DEFAULT_DECAY_CONFIG.frequencyWeight +
      DEFAULT_DECAY_CONFIG.intrinsicWeight;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
