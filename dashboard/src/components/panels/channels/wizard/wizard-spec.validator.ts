import type { WizardSpec } from "./wizard-spec.types";

const REF_PATTERN = /^\$steps\.[a-zA-Z0-9_-]+\.value(\.[a-zA-Z0-9_-]+)*$/;
const DANGEROUS_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);
const STEP_TYPES = new Set(["info", "radio", "form", "action"]);

export class InvalidWizardSpecError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid wizard spec:\n- ${issues.join("\n- ")}`);
    this.name = "InvalidWizardSpecError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isI18nString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRef(path: string, errors: string[], label: string) {
  if (!REF_PATTERN.test(path)) {
    errors.push(`${label}: invalid $ref syntax (${path})`);
    return;
  }
  const segments = path.split(".");
  if (segments.some((segment) => DANGEROUS_SEGMENTS.has(segment))) {
    errors.push(`${label}: disallowed $ref segment (${path})`);
  }
}

function validateActionNamespace(
  action: unknown,
  channelId: string,
  errors: string[],
  label: string,
) {
  if (typeof action !== "string" || action.trim().length === 0) {
    errors.push(`${label}: action is required`);
    return;
  }
  if (!action.startsWith(`channel.${channelId}.`)) {
    errors.push(`${label}: action must start with channel.${channelId}.`);
  }
}

function validateParams(
  params: unknown,
  errors: string[],
  label: string,
): params is Record<string, string | number | boolean | { $ref: string }> | undefined {
  if (params === undefined) {
    return true;
  }
  if (!isRecord(params)) {
    errors.push(`${label}: params must be an object`);
    return false;
  }
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      continue;
    }
    if (isRecord(value) && typeof value.$ref === "string") {
      validateRef(value.$ref, errors, `${label}.${key}`);
      continue;
    }
    errors.push(`${label}.${key}: invalid param value`);
  }
  return true;
}

export function collectWizardSpecErrors(spec: unknown, channelId: string): string[] {
  const errors: string[] = [];
  if (!isRecord(spec)) {
    return ["spec must be an object"];
  }

  const steps = spec.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push("steps must be a non-empty array");
  } else {
    const seenIds = new Set<string>();
    for (const [index, step] of steps.entries()) {
      const label = `steps[${index}]`;
      if (!isRecord(step)) {
        errors.push(`${label}: step must be an object`);
        continue;
      }
      if (typeof step.id !== "string" || step.id.trim().length === 0) {
        errors.push(`${label}: id is required`);
      } else if (seenIds.has(step.id)) {
        errors.push(`${label}: duplicate step id (${step.id})`);
      } else {
        seenIds.add(step.id);
      }

      if (typeof step.type !== "string" || !STEP_TYPES.has(step.type)) {
        errors.push(`${label}: unsupported type (${String(step.type)})`);
        continue;
      }
      if (!isI18nString(step.title)) {
        errors.push(`${label}: title is required`);
      }

      switch (step.type) {
        case "info":
          if (!isI18nString(step.body)) {
            errors.push(`${label}: body is required for info steps`);
          }
          break;
        case "radio":
          if (!Array.isArray(step.options) || step.options.length === 0) {
            errors.push(`${label}: radio step requires options`);
            break;
          }
          for (const [optionIndex, option] of step.options.entries()) {
            if (!isRecord(option)) {
              errors.push(`${label}.options[${optionIndex}]: option must be an object`);
              continue;
            }
            if (!isI18nString(option.value)) {
              errors.push(`${label}.options[${optionIndex}]: value is required`);
            }
            if (!isI18nString(option.label)) {
              errors.push(`${label}.options[${optionIndex}]: label is required`);
            }
          }
          break;
        case "form":
          if (!isRecord(step.schema)) {
            errors.push(`${label}: form step requires schema object`);
          }
          break;
        case "action":
          validateActionNamespace(step.action, channelId, errors, label);
          validateParams(step.params, errors, label);
          break;
      }
    }
  }

  const onComplete = spec.onComplete;
  if (!isRecord(onComplete)) {
    errors.push("onComplete must be an object");
  } else {
    validateActionNamespace(onComplete.action, channelId, errors, "onComplete");
    validateParams(onComplete.params, errors, "onComplete");
  }

  return errors;
}

export function assertValidWizardSpec(
  spec: unknown,
  channelId: string,
): asserts spec is WizardSpec {
  const errors = collectWizardSpecErrors(spec, channelId);
  if (errors.length > 0) {
    throw new InvalidWizardSpecError(errors);
  }
}
