"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import type { FormField } from "@/lib/schema-parser";

interface SchemaFormProps {
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix?: string;
}

function FieldLabel({ field }: { field: FormField }) {
  return (
    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
      {field.key}
      {field.required && <span style={{ color: "var(--status-disconnected)" }}> *</span>}
      {field.description && (
        <span className="ml-1 font-normal" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
          — {field.description}
        </span>
      )}
    </label>
  );
}

function StringField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-3">
      <FieldLabel field={field} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={typeof field.defaultValue === "string" ? field.defaultValue : ""}
        className="w-full max-w-md text-xs rounded px-2 py-1.5"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      />
    </div>
  );
}

function NumberField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: number | string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <FieldLabel field={field} />
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={field.defaultValue != null ? JSON.stringify(field.defaultValue) : ""}
        className="w-full max-w-xs text-xs rounded px-2 py-1.5"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      />
    </div>
  );
}

function BooleanField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
        style={{
          backgroundColor: value ? "var(--accent)" : "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
          style={{
            backgroundColor: value ? "var(--accent-fg)" : "var(--text-secondary)",
            transform: value ? "translateX(17px)" : "translateX(2px)",
          }}
        />
      </button>
      <FieldLabel field={field} />
    </div>
  );
}

function EnumField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-3">
      <FieldLabel field={field} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-md text-xs rounded px-2 py-1.5"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      >
        <option value="">—</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function ArrayField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: string) => void;
}) {
  const text = Array.isArray(value)
    ? JSON.stringify(value, null, 2)
    : typeof value === "string"
      ? value
      : JSON.stringify(value ?? "[]");
  return (
    <div className="mb-3">
      <FieldLabel field={field} />
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full max-w-md text-xs rounded px-2 py-1.5 font-mono resize-y"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      />
    </div>
  );
}

function ObjectField({
  field,
  values,
  onChange,
  prefix,
}: {
  field: FormField;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1 text-xs font-medium mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        {field.key}
        {field.description && (
          <span
            className="ml-1 font-normal"
            style={{ color: "var(--text-secondary)", opacity: 0.7 }}
          >
            — {field.description}
          </span>
        )}
      </button>
      {!collapsed && field.children && (
        <div className="ml-3 pl-3 border-l" style={{ borderColor: "var(--border)" }}>
          <SchemaForm
            fields={field.children}
            values={(values[field.key] as Record<string, unknown>) ?? {}}
            onChange={(childKey, value) => {
              onChange(`${prefix}${field.key}.${childKey}`, value);
            }}
            prefix={`${prefix}${field.key}.`}
          />
        </div>
      )}
    </div>
  );
}

export function SchemaForm({ fields, values, onChange, prefix = "" }: SchemaFormProps) {
  const tc = useTranslations("common");
  const handleChange = useCallback(
    (key: string, value: unknown) => {
      onChange(key, value);
    },
    [onChange],
  );

  if (fields.length === 0) {
    return (
      <div className="text-xs py-2" style={{ color: "var(--text-secondary)" }}>
        {tc("noConfigurableFields")}
      </div>
    );
  }

  return (
    <div>
      {fields.map((field) => {
        const fullKey = `${prefix}${field.key}`;
        const value = values[field.key];

        switch (field.type) {
          case "string":
            return (
              <StringField
                key={fullKey}
                field={field}
                value={
                  typeof value === "string" ? value : value != null ? JSON.stringify(value) : ""
                }
                onChange={(v) => handleChange(field.key, v)}
              />
            );
          case "number":
            return (
              <NumberField
                key={fullKey}
                field={field}
                value={typeof value === "number" ? value : ""}
                onChange={(v) => handleChange(field.key, v)}
              />
            );
          case "boolean":
            return (
              <BooleanField
                key={fullKey}
                field={field}
                value={Boolean(value ?? field.defaultValue ?? false)}
                onChange={(v) => handleChange(field.key, v)}
              />
            );
          case "enum":
            return (
              <EnumField
                key={fullKey}
                field={field}
                value={
                  typeof value === "string" ? value : value != null ? JSON.stringify(value) : ""
                }
                onChange={(v) => handleChange(field.key, v)}
              />
            );
          case "array":
            return (
              <ArrayField
                key={fullKey}
                field={field}
                value={value}
                onChange={(v) => {
                  try {
                    handleChange(field.key, JSON.parse(v));
                  } catch {
                    // Keep raw string if not valid JSON
                    handleChange(field.key, v);
                  }
                }}
              />
            );
          case "object":
            return (
              <ObjectField
                key={fullKey}
                field={field}
                values={values}
                onChange={handleChange}
                prefix={prefix}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
