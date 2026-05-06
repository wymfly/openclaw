import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { TSchema } from "@sinclair/typebox";
import { formatGeneratedModule } from "../../../scripts/lib/format-generated-module.mjs";
import {
  PROTOCOL_VERSION,
  allEventDefs,
  allEventNames,
  allMethodDefs,
} from "../../../src/gateway/method-registry-data.js";
import {
  TranscriptBlockSchema,
  TranscriptMessageSchema,
} from "../../../src/gateway/protocol/schema/transcript.js";

export { PROTOCOL_VERSION, TranscriptBlockSchema, TranscriptMessageSchema };

export type MethodDef = {
  params?: TSchema;
  result?: TSchema;
};

export type EventDef = {
  payload?: TSchema;
};

export type GeneratedFile = {
  path: string;
  content: string;
};

export const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const CONTRACTS_ROOT = resolve(SCRIPT_DIR, "..");
export const DECK_GO_ROOT = resolve(CONTRACTS_ROOT, "..");
export const REPO_ROOT = resolve(DECK_GO_ROOT, "..");
export const TS_GATEWAY_OUT_DIR = resolve(CONTRACTS_ROOT, "generated/ts/gateway");
export const GO_GATEWAY_OUT_DIR = resolve(DECK_GO_ROOT, "backend/internal/gateway/generated");

export const methodDefs = allMethodDefs as Record<string, MethodDef>;
export const eventDefs = allEventDefs as Record<string, EventDef>;
export const eventNames = [...allEventNames];

export function typedMethodNames(): string[] {
  return sortedKeys(methodDefs).filter((method) => {
    const def = methodDefs[method];
    return Boolean(def?.params || def?.result);
  });
}

export function allowlistMethodNames(): string[] {
  return sortedKeys(methodDefs);
}

export function sortedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).toSorted((a, b) => a.localeCompare(b));
}

export function sortedEntries<T>(value: Record<string, T>): [string, T][] {
  return sortedKeys(value).map((key) => [key, value[key]]);
}

export function schemaRecord(schema: TSchema): Record<string, unknown> {
  return schema as Record<string, unknown>;
}

export function methodToPascalName(method: string): string {
  return method
    .split(".")
    .flatMap((part) => part.split(/[^a-zA-Z0-9]+/))
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join("");
}

export function quoteTSKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function isStringLiteralType(type: string): boolean {
  if (!type.startsWith('"')) {
    return false;
  }
  try {
    return typeof JSON.parse(type) === "string";
  } catch {
    return false;
  }
}

function isNumberLiteralType(type: string): boolean {
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(type);
}

function removeRedundantUnionMembers(types: string[]): string[] {
  let next = [...types];
  if (next.includes("string")) {
    next = next.filter((type) => !isStringLiteralType(type));
  }
  if (next.includes("number")) {
    next = next.filter((type) => !isNumberLiteralType(type));
  }
  if (next.includes("boolean")) {
    next = next.filter((type) => type !== "true" && type !== "false");
  }
  return next;
}

export function schemaToTS(schema: TSchema, indent = 0): string {
  const pad = "  ".repeat(indent);
  const s = schemaRecord(schema);
  const kind = s.type as string | undefined;

  if (typeof s.$ref === "string") {
    const ref = s.$ref.split("/").at(-1)?.replace(/#$/, "") ?? s.$ref;
    return ref || "unknown";
  }

  if ("const" in s) {
    const val = s.const;
    return typeof val === "string" ? JSON.stringify(val) : String(val);
  }

  if (kind === "string") {
    return "string";
  }
  if (kind === "number" || kind === "integer") {
    return "number";
  }
  if (kind === "boolean") {
    return "boolean";
  }
  if (kind === "null") {
    return "null";
  }

  if (kind === "array") {
    const items = s.items as TSchema | undefined;
    if (!items) {
      return "unknown[]";
    }
    const inner = schemaToTS(items, indent);
    return inner.includes("|") ? `(${inner})[]` : `${inner}[]`;
  }

  if (kind === "object") {
    const patternProps = s.patternProperties as Record<string, TSchema> | undefined;
    if (patternProps) {
      const valueSchema = Object.values(patternProps)[0];
      return valueSchema
        ? `Record<string, ${schemaToTS(valueSchema, indent)}>`
        : "Record<string, unknown>";
    }

    const props = s.properties as Record<string, TSchema> | undefined;
    if (!props || Object.keys(props).length === 0) {
      return "{}";
    }

    const required = new Set((s.required as string[] | undefined) ?? []);
    const lines = sortedEntries(props).map(([key, propSchema]) => {
      const opt = required.has(key) ? "" : "?";
      return `${pad}  ${quoteTSKey(key)}${opt}: ${schemaToTS(propSchema, indent + 1)};`;
    });
    return `{\n${lines.join("\n")}\n${pad}}`;
  }

  if ("anyOf" in s) {
    const rendered = (s.anyOf as TSchema[]).map((variant) => schemaToTS(variant, indent));
    const deduped = [...new Set(rendered)].toSorted((a, b) => a.localeCompare(b));
    if (deduped.includes("unknown")) {
      return "unknown";
    }
    return removeRedundantUnionMembers(deduped).join(" | ");
  }

  return "unknown";
}

export function emitNamedTSType(lines: string[], name: string, schema: TSchema): void {
  const body = schemaToTS(schema);
  if (body === "{}") {
    lines.push(`export type ${name} = Record<string, never>;`);
    lines.push("");
    return;
  }
  if (body.startsWith("{\n") && body.endsWith("\n}") && !body.includes("|")) {
    lines.push(`export interface ${name} ${body}`);
    lines.push("");
    return;
  }
  lines.push(`export type ${name} = ${body};`);
  lines.push("");
}

export function formatTS(content: string, outputPath: string, label: string): string {
  return formatGeneratedModule(content, {
    repoRoot: REPO_ROOT,
    outputPath,
    errorLabel: label,
  });
}

export function formatGo(content: string): string {
  const formatter = spawnSync("gofmt", {
    input: content,
    encoding: "utf8",
  });
  if (formatter.status !== 0) {
    const details =
      formatter.stderr?.trim() || formatter.stdout?.trim() || formatter.error?.message || "unknown";
    throw new Error(`failed to format generated Go: ${details}`);
  }
  return formatter.stdout;
}

export function writeGeneratedFiles(files: GeneratedFile[]): void {
  for (const file of files) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content);
    console.log(`wrote ${file.path}`);
  }
}

export function checkGeneratedFiles(files: GeneratedFile[], fixCommand: string): boolean {
  let ok = true;
  for (const file of files) {
    if (!existsSync(file.path)) {
      console.error(`MISSING: ${file.path}`);
      ok = false;
      continue;
    }
    const actual = readFileSync(file.path, "utf8");
    if (actual !== file.content) {
      console.error(`DRIFT: ${file.path}`);
      ok = false;
    }
  }
  if (!ok) {
    console.error(`Run '${fixCommand}' to regenerate deck-go Gateway protocol artifacts.`);
  }
  return ok;
}
