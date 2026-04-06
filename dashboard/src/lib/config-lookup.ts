import type {
  ConfigGetResult,
  ConfigSchemaLookupResult,
  ConfigSchemaResult,
} from "@/types/gateway-protocol.generated";

export type ConfigLookupResult = ConfigSchemaLookupResult;
export type ConfigLookupChild = ConfigSchemaLookupResult["children"][number];
export type ConfigSchemaBootstrap = ConfigSchemaResult;
export type ConfigReadSnapshot = ConfigGetResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isHintShape(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  if ("tags" in value && value.tags !== undefined && !Array.isArray(value.tags)) {
    return false;
  }
  return true;
}

function isLookupChild(value: unknown): value is ConfigLookupChild {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.key === "string" &&
    typeof value.path === "string" &&
    typeof value.required === "boolean" &&
    typeof value.hasChildren === "boolean" &&
    isHintShape(value.hint)
  );
}

export function parseConfigLookupResult(value: unknown): ConfigLookupResult | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.path !== "string") {
    return null;
  }
  if (!Array.isArray(value.children) || !value.children.every(isLookupChild)) {
    return null;
  }
  if (!isHintShape(value.hint)) {
    return null;
  }
  return value as ConfigLookupResult;
}

export function parseConfigSchemaResult(value: unknown): ConfigSchemaBootstrap | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!("schema" in value) || !isRecord(value.uiHints)) {
    return null;
  }
  if (typeof value.version !== "string" || typeof value.generatedAt !== "string") {
    return null;
  }
  return value as ConfigSchemaBootstrap;
}

export function parseConfigGetResult(value: unknown): ConfigReadSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.path !== "string" ||
    typeof value.exists !== "boolean" ||
    typeof value.valid !== "boolean"
  ) {
    return null;
  }
  if (value.raw !== null && typeof value.raw !== "string") {
    return null;
  }
  if (!("config" in value)) {
    return null;
  }
  if (value.hash !== undefined && typeof value.hash !== "string") {
    return null;
  }
  return value as ConfigReadSnapshot;
}

export function resolveSectionSchemaNode(params: {
  activeSection: string | null;
  lookupResult: ConfigLookupResult | null;
}): Record<string, unknown> | null {
  const { activeSection, lookupResult } = params;
  if (!activeSection) {
    return null;
  }
  if (
    lookupResult &&
    lookupResult.path === activeSection &&
    lookupResult.schema &&
    typeof lookupResult.schema === "object"
  ) {
    return lookupResult.schema as Record<string, unknown>;
  }
  return null;
}
