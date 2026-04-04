export interface ProtocolCoverageSummary {
  total: number;
  typed: number;
  untyped: number;
  direct: number;
  notCovered: number;
}

export interface ProtocolCoverageFamily {
  family: string;
  typed: string[];
  untyped: string[];
  direct: string[];
  notCovered: string[];
}

export interface BuildProtocolCoverageReportInput {
  allMethodNames: readonly string[];
  typedSchemaMethods: ReadonlySet<string>;
  typedUsedMethods: ReadonlySet<string>;
  untypedUsedMethods: ReadonlySet<string>;
  directUsedMethods: ReadonlySet<string>;
}

export interface ProtocolCoverageReport {
  summary: ProtocolCoverageSummary;
  families: ProtocolCoverageFamily[];
  typedSchemaMethods: string[];
  typedMethods: string[];
  untypedMethods: string[];
  directMethods: string[];
  notCoveredMethods: string[];
  unknownUsedMethods: string[];
  typedWithoutSchemaMethods: string[];
}

export interface ProtocolMethodUsage {
  typedUsedMethods: Set<string>;
  untypedUsedMethods: Set<string>;
  directUsedMethods: Set<string>;
}

const TYPED_USAGE_PATTERN = /\bgwRequest\s*\(\s*["'`]([^"'`]+)["'`]/g;
const UNTYPED_USAGE_PATTERN = /\bgatewayRequest\s*\(\s*["'`]([^"'`]+)["'`]/g;
const DIRECT_USAGE_PATTERN = /\b(?:runtime\.)?adapter\.request\s*\(\s*["'`]([^"'`]+)["'`]/g;

function normalizeKnownMethods(
  methods: readonly string[],
  knownMethods: ReadonlySet<string>,
): string[] {
  return [...new Set(methods)].filter((method) => knownMethods.has(method)).toSorted();
}

function getMethodFamily(name: string): string {
  return name.split(".").slice(0, 2).join(".");
}

function collectMatches(pattern: RegExp, source: string, target: Set<string>) {
  pattern.lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    target.add(match[1]);
  }
}

export function collectProtocolMethodUsageFromSource(source: string): ProtocolMethodUsage {
  const usage: ProtocolMethodUsage = {
    typedUsedMethods: new Set<string>(),
    untypedUsedMethods: new Set<string>(),
    directUsedMethods: new Set<string>(),
  };

  collectMatches(TYPED_USAGE_PATTERN, source, usage.typedUsedMethods);
  collectMatches(UNTYPED_USAGE_PATTERN, source, usage.untypedUsedMethods);
  collectMatches(DIRECT_USAGE_PATTERN, source, usage.directUsedMethods);

  return usage;
}

export function mergeProtocolMethodUsage(
  usageList: Iterable<ProtocolMethodUsage>,
): ProtocolMethodUsage {
  const merged: ProtocolMethodUsage = {
    typedUsedMethods: new Set<string>(),
    untypedUsedMethods: new Set<string>(),
    directUsedMethods: new Set<string>(),
  };

  for (const usage of usageList) {
    for (const method of usage.typedUsedMethods) {
      merged.typedUsedMethods.add(method);
    }
    for (const method of usage.untypedUsedMethods) {
      merged.untypedUsedMethods.add(method);
    }
    for (const method of usage.directUsedMethods) {
      merged.directUsedMethods.add(method);
    }
  }

  return merged;
}

export function buildProtocolCoverageReport(
  input: BuildProtocolCoverageReportInput,
): ProtocolCoverageReport {
  const knownMethods = [...new Set(input.allMethodNames)].toSorted();
  const knownMethodSet = new Set(knownMethods);

  const typedSchemaMethods = normalizeKnownMethods([...input.typedSchemaMethods], knownMethodSet);
  const typedSchemaMethodSet = new Set(typedSchemaMethods);
  const typedMethods = [...input.typedUsedMethods]
    .filter((method) => typedSchemaMethodSet.has(method))
    .toSorted();
  const typedMethodSet = new Set(typedMethods);
  const untypedMethods = normalizeKnownMethods([...input.untypedUsedMethods], knownMethodSet);
  const untypedMethodSet = new Set(untypedMethods);
  const directMethods = normalizeKnownMethods([...input.directUsedMethods], knownMethodSet);
  const directMethodSet = new Set(directMethods);

  const families = new Map<string, ProtocolCoverageFamily>();
  const notCoveredMethods: string[] = [];
  let typedCount = 0;
  let untypedCount = 0;
  let directCount = 0;

  // Primary coverage status is exclusive for summary totals; raw-use lists below preserve overlap details.
  for (const method of knownMethods) {
    const family = getMethodFamily(method);
    if (!families.has(family)) {
      families.set(family, {
        family,
        typed: [],
        untyped: [],
        direct: [],
        notCovered: [],
      });
    }

    const entry = families.get(family);
    if (!entry) {
      continue;
    }

    if (typedMethodSet.has(method)) {
      entry.typed.push(method);
      typedCount += 1;
      continue;
    }

    if (untypedMethodSet.has(method)) {
      entry.untyped.push(method);
      untypedCount += 1;
      continue;
    }

    if (directMethodSet.has(method)) {
      entry.direct.push(method);
      directCount += 1;
      continue;
    }

    entry.notCovered.push(method);
    notCoveredMethods.push(method);
  }

  const usedMethods = new Set<string>([
    ...input.typedUsedMethods,
    ...input.untypedUsedMethods,
    ...input.directUsedMethods,
  ]);

  const unknownUsedMethods = [...usedMethods]
    .filter((method) => !knownMethodSet.has(method))
    .toSorted();
  const typedWithoutSchemaMethods = [...input.typedUsedMethods]
    .filter((method) => knownMethodSet.has(method) && !typedSchemaMethodSet.has(method))
    .toSorted();

  return {
    summary: {
      total: knownMethods.length,
      typed: typedCount,
      untyped: untypedCount,
      direct: directCount,
      notCovered: notCoveredMethods.length,
    },
    families: [...families.values()].toSorted((a, b) => a.family.localeCompare(b.family)),
    typedSchemaMethods,
    typedMethods,
    untypedMethods,
    directMethods,
    notCoveredMethods,
    unknownUsedMethods,
    typedWithoutSchemaMethods,
  };
}
