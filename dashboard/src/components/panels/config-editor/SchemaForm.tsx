"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { FormField } from "@/lib/schema-parser";
import { cn } from "@/lib/utils";

interface SchemaFormProps {
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix?: string;
}

function FieldLabel({ field }: { field: FormField }) {
  return (
    <Label className="text-xs text-[var(--text-secondary)] mb-1">
      <span className="font-mono">{field.key}</span>
      {field.required && <span className="text-[var(--danger)]"> *</span>}
      {field.description && (
        <span className="ml-1.5 font-normal opacity-70">— {field.description}</span>
      )}
    </Label>
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
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={typeof field.defaultValue === "string" ? field.defaultValue : ""}
        className="w-full max-w-md text-xs h-7"
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
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={field.defaultValue != null ? JSON.stringify(field.defaultValue) : ""}
        className="w-full max-w-xs text-xs h-7 font-mono"
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
      <Switch checked={value} onCheckedChange={onChange} />
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
      <Select value={value || undefined} onValueChange={(v) => onChange(v as string)}>
        <SelectTrigger size="sm" className="w-full max-w-md text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
        className={cn(
          "w-full max-w-md text-xs rounded-lg px-2.5 py-1.5 font-mono resize-y",
          "border border-[var(--border)] bg-transparent text-[var(--text-primary)]",
          "placeholder:text-[var(--text-secondary)]",
          "focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
          "outline-none transition-colors duration-150",
        )}
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
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-3">
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-1 text-xs font-medium mb-1 cursor-pointer transition-colors duration-150",
          "text-[var(--text-primary)] hover:text-[var(--accent)]",
        )}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="font-mono">{field.key}</span>
        {field.description && (
          <span className="ml-1.5 font-normal text-[var(--text-secondary)] opacity-70">
            — {field.description}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {field.children && (
          <div className="ml-3 pl-3 border-l border-[var(--border-subtle)]">
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
      </CollapsibleContent>
    </Collapsible>
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
      <div className="text-xs py-2 text-[var(--text-secondary)]">{tc("noConfigurableFields")}</div>
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
