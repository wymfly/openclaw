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
    <Label className="text-xs text-muted-foreground mb-1">
      {field.key}
      {field.required && <span className="text-destructive"> *</span>}
      {field.description && (
        <span className="ml-1 font-normal opacity-70">— {field.description}</span>
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
        className="w-full max-w-xs text-xs h-7"
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
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors border",
          value ? "bg-primary border-primary" : "bg-card border-border",
        )}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 rounded-full transition-transform",
            value
              ? "translate-x-[17px] bg-primary-foreground"
              : "translate-x-[2px] bg-muted-foreground",
          )}
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
        className="w-full max-w-md text-xs rounded-lg px-2.5 py-1.5 font-mono resize-y border border-input bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none transition-colors"
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
      <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium mb-1 text-foreground">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {field.key}
        {field.description && (
          <span className="ml-1 font-normal text-muted-foreground opacity-70">
            — {field.description}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {field.children && (
          <div className="ml-3 pl-3 border-l border-border">
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
    return <div className="text-xs py-2 text-muted-foreground">{tc("noConfigurableFields")}</div>;
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
