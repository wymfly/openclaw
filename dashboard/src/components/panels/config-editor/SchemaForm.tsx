"use client";

import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { FormField } from "@/lib/schema-parser";
import { FieldHelpPopover } from "./FieldHelpPopover";
import { PasswordField } from "./fields/PasswordField";
import { RecordField } from "./fields/RecordField";
import { TypedArrayField } from "./fields/TypedArrayField";
import { UnionField } from "./fields/UnionField";

/** Hint data from config.schema.lookup for a given field path. */
export interface FieldHint {
  inputType?: string;
  enum?: string[];
}

interface SchemaFormProps {
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix?: string;
  /** Optional hints keyed by field path (from config.schema.lookup). Progressive enhancement only. */
  hints?: Record<string, FieldHint>;
}

function FieldLabel({ field }: { field: FormField }) {
  return (
    <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
      {field.key}
      {field.required && <span style={{ color: "var(--status-disconnected)" }}> *</span>}
      {field.description && (
        <span
          className="ml-1 font-normal"
          style={{ color: "var(--muted-foreground)", opacity: 0.7 }}
        >
          — {field.description}
        </span>
      )}
      <FieldHelpPopover help={field.help} />
      {field.defaultValue != null && (
        <span className="text-[10px] ml-1" style={{ color: "var(--text-tertiary)" }}>
          (default: {String(field.defaultValue)})
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
        placeholder={
          field.placeholder ?? (typeof field.defaultValue === "string" ? field.defaultValue : "")
        }
        className="w-full max-w-md text-xs rounded px-2 py-1.5"
        style={{
          backgroundColor: "var(--card)",
          color: "var(--foreground)",
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
          backgroundColor: "var(--card)",
          color: "var(--foreground)",
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
          backgroundColor: value ? "var(--primary)" : "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
          style={{
            backgroundColor: value ? "var(--primary-foreground)" : "var(--muted-foreground)",
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
  options,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
}) {
  const effectiveOptions = options ?? field.options;
  return (
    <div className="mb-3">
      <FieldLabel field={field} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-md text-xs rounded px-2 py-1.5"
        style={{
          backgroundColor: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        }}
      >
        <option value="">—</option>
        {effectiveOptions?.map((opt) => (
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
          backgroundColor: "var(--card)",
          color: "var(--foreground)",
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
  hints,
}: {
  field: FormField;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix: string;
  hints?: Record<string, FieldHint>;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1 text-xs font-medium mb-1"
        style={{ color: "var(--foreground)" }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        {field.key}
        {field.description && (
          <span
            className="ml-1 font-normal"
            style={{ color: "var(--muted-foreground)", opacity: 0.7 }}
          >
            — {field.description}
          </span>
        )}
        <FieldHelpPopover help={field.help} />
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
            hints={hints}
          />
        </div>
      )}
    </div>
  );
}

/** Group heading for field groups */
function GroupHeading({ label }: { label: string }) {
  return (
    <div
      className="text-[11px] font-semibold uppercase tracking-wide mt-4 mb-2 pb-1 border-b"
      style={{ color: "var(--muted-foreground)", borderColor: "var(--border-subtle)" }}
    >
      {label}
    </div>
  );
}

/** Render a single field with the correct component based on type and metadata */
function FieldRenderer({
  field,
  values,
  onChange,
  prefix,
  hints,
}: {
  field: FormField;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix: string;
  hints?: Record<string, FieldHint>;
}) {
  const fullKey = `${prefix}${field.key}`;
  const value = values[field.key];
  const hint = hints?.[fullKey];

  // --- Advanced field component routing (before basic type switch) ---

  // Sensitive / password field (already wired, keep first)
  if (field.type === "string" && (field.sensitive || hint?.inputType === "password")) {
    const strVal = typeof value === "string" ? value : value != null ? JSON.stringify(value) : "";
    return (
      <PasswordField
        key={fullKey}
        field={field}
        value={strVal}
        onChange={(v) => onChange(field.key, v)}
      />
    );
  }

  // Union field (discriminated or simple)
  if (field.variants && field.variants.length > 0) {
    return (
      <UnionField key={fullKey} field={field} value={value} onChange={onChange} prefix={prefix} />
    );
  }

  // Record/map field
  if (field.type === "object" && field.valueSchema) {
    return (
      <RecordField
        key={fullKey}
        field={field}
        value={(value as Record<string, unknown>) ?? {}}
        onChange={onChange}
        prefix={prefix}
      />
    );
  }

  // Typed array field
  if (field.type === "array" && field.itemSchema) {
    return (
      <TypedArrayField
        key={fullKey}
        field={field}
        value={Array.isArray(value) ? value : []}
        onChange={(v) => onChange(field.key, v)}
        prefix={prefix}
      />
    );
  }

  // --- Basic type switch ---
  switch (field.type) {
    case "string": {
      const strVal = typeof value === "string" ? value : value != null ? JSON.stringify(value) : "";
      // Use EnumField when hint provides enum options (progressive enhancement)
      if (hint?.enum && hint.enum.length > 0) {
        return (
          <EnumField
            key={fullKey}
            field={field}
            value={strVal}
            options={hint.enum}
            onChange={(v) => onChange(field.key, v)}
          />
        );
      }
      return (
        <StringField
          key={fullKey}
          field={field}
          value={strVal}
          onChange={(v) => onChange(field.key, v)}
        />
      );
    }
    case "number":
      return (
        <NumberField
          key={fullKey}
          field={field}
          value={typeof value === "number" ? value : ""}
          onChange={(v) => onChange(field.key, v)}
        />
      );
    case "boolean":
      return (
        <BooleanField
          key={fullKey}
          field={field}
          value={Boolean(value ?? field.defaultValue ?? false)}
          onChange={(v) => onChange(field.key, v)}
        />
      );
    case "enum":
      return (
        <EnumField
          key={fullKey}
          field={field}
          value={typeof value === "string" ? value : value != null ? JSON.stringify(value) : ""}
          onChange={(v) => onChange(field.key, v)}
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
              onChange(field.key, JSON.parse(v));
            } catch {
              onChange(field.key, v);
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
          onChange={onChange}
          prefix={prefix}
          hints={hints}
        />
      );
    default:
      return null;
  }
}

export function SchemaForm({ fields, values, onChange, prefix = "", hints }: SchemaFormProps) {
  const t = useTranslations("config");
  const tc = useTranslations("common");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      onChange(key, value);
    },
    [onChange],
  );

  // Partition fields: regular vs advanced, then group regular fields
  const { groupedRegular, advancedFields } = useMemo(() => {
    const regular: FormField[] = [];
    const advanced: FormField[] = [];

    for (const field of fields) {
      if (field.tags?.includes("advanced")) {
        advanced.push(field);
      } else {
        regular.push(field);
      }
    }

    // Group regular fields by field.group
    const grouped = new Map<string, FormField[]>();
    const ungrouped: FormField[] = [];

    for (const field of regular) {
      if (field.group) {
        const existing = grouped.get(field.group);
        if (existing) {
          existing.push(field);
        } else {
          grouped.set(field.group, [field]);
        }
      } else {
        ungrouped.push(field);
      }
    }

    return {
      groupedRegular: { ungrouped, groups: grouped },
      advancedFields: advanced,
    };
  }, [fields]);

  if (fields.length === 0) {
    return (
      <div className="text-xs py-2" style={{ color: "var(--muted-foreground)" }}>
        {tc("noConfigurableFields")}
      </div>
    );
  }

  return (
    <div>
      {/* Ungrouped fields first */}
      {groupedRegular.ungrouped.map((field) => (
        <FieldRenderer
          key={`${prefix}${field.key}`}
          field={field}
          values={values}
          onChange={handleChange}
          prefix={prefix}
          hints={hints}
        />
      ))}

      {/* Grouped fields with headings */}
      {Array.from(groupedRegular.groups.entries()).map(([groupName, groupFields]) => (
        <div key={groupName}>
          <GroupHeading label={groupName} />
          {groupFields.map((field) => (
            <FieldRenderer
              key={`${prefix}${field.key}`}
              field={field}
              values={values}
              onChange={handleChange}
              prefix={prefix}
              hints={hints}
            />
          ))}
        </div>
      ))}

      {/* Advanced fields in collapsible section */}
      {advancedFields.length > 0 && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger
            className="flex items-center gap-1.5 text-xs mt-4 mb-2 py-1 transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Settings2 size={12} />
            <span>
              {advancedOpen
                ? t("hideAdvanced")
                : t("showAdvanced", { count: advancedFields.length })}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div
              className="pl-3 border-l"
              style={{
                borderColor: "color-mix(in srgb, var(--muted-foreground) 30%, transparent)",
              }}
            >
              {advancedFields.map((field) => (
                <FieldRenderer
                  key={`${prefix}${field.key}`}
                  field={field}
                  values={values}
                  onChange={handleChange}
                  prefix={prefix}
                  hints={hints}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
