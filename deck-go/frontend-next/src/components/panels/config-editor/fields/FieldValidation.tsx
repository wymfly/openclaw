"use client";

import { useTranslations } from "next-intl";
import type { ValidationConstraints } from "@/lib/schema-parser";

/**
 * Validate a field value against its constraints and optional format hint.
 *
 * Returns an error key string (e.g. "minLength:1", "max:65535", "pattern")
 * when validation fails, or null when the value is valid.
 *
 * Empty / undefined values are not checked (required-field validation is
 * a separate concern handled at the form level).
 */
export function validateField(
  value: unknown,
  validation?: ValidationConstraints,
  format?: string,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  // --- String constraints ---
  if (typeof value === "string") {
    if (validation?.minLength !== undefined && value.length < validation.minLength) {
      return `minLength:${validation.minLength}`;
    }
    if (validation?.maxLength !== undefined && value.length > validation.maxLength) {
      return `maxLength:${validation.maxLength}`;
    }
    if (validation?.pattern !== undefined) {
      try {
        if (!new RegExp(validation.pattern).test(value)) {
          return "pattern";
        }
      } catch {
        // Ignore malformed regex
      }
    }
    // Format checks
    if (format === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return "format:email";
      }
    }
    if (format === "uri") {
      if (!value.startsWith("http://") && !value.startsWith("https://")) {
        return "format:uri";
      }
    }
  }

  // --- Number constraints ---
  if (typeof value === "number") {
    if (validation?.minimum !== undefined && value < validation.minimum) {
      return `min:${validation.minimum}`;
    }
    if (validation?.maximum !== undefined && value > validation.maximum) {
      return `max:${validation.maximum}`;
    }
  }

  return null;
}

/**
 * Renders an inline validation error message below a field.
 * Only renders when `touched` is true and `errorKey` is non-null.
 */
export function FieldValidationError({
  errorKey,
  touched,
}: {
  errorKey: string | null;
  touched: boolean;
}) {
  const t = useTranslations("config");

  if (!touched || !errorKey) {
    return null;
  }

  let message: string;

  if (errorKey.startsWith("minLength:")) {
    const min = errorKey.slice("minLength:".length);
    message = t("validationMinLength", { min });
  } else if (errorKey.startsWith("maxLength:")) {
    const max = errorKey.slice("maxLength:".length);
    message = t("validationMaxLength", { max });
  } else if (errorKey.startsWith("min:")) {
    const min = errorKey.slice("min:".length);
    message = t("validationMin", { min });
  } else if (errorKey.startsWith("max:")) {
    const max = errorKey.slice("max:".length);
    message = t("validationMax", { max });
  } else if (errorKey === "pattern" || errorKey === "format:email" || errorKey === "format:uri") {
    message = t("validationPattern");
  } else {
    message = t("validationPattern");
  }

  return (
    <p className="mt-0.5 text-[10px] text-[var(--destructive)] leading-tight" role="alert">
      {message}
    </p>
  );
}
