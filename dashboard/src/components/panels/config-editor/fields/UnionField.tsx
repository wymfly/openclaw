"use client";

import { useTranslations } from "next-intl";
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
import { SchemaForm } from "../SchemaForm";

interface UnionFieldProps {
  field: FormField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  prefix: string;
}

export function UnionField({ field, value, onChange, prefix }: UnionFieldProps) {
  const t = useTranslations("config");
  const variants = field.variants ?? [];

  // Discriminated union: value is an object with a discriminator key
  if (field.discriminator) {
    const objValue = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const activeVariantValue = (objValue[field.discriminator] as string) ?? "";
    const activeVariant = variants.find((v) => v.value === activeVariantValue);

    const handleVariantSwitch = (newVariantValue: string) => {
      // Clear previous variant's values, keep only the discriminator
      onChange(field.key, { [field.discriminator!]: newVariantValue });
    };

    return (
      <div className="mb-3">
        <Label className="text-xs text-[var(--text-secondary)] mb-1">
          <span className="font-mono">{field.key}</span>
          {field.required && <span className="text-[var(--danger)]"> *</span>}
          {field.description && (
            <span className="ml-1.5 font-normal opacity-70">— {field.description}</span>
          )}
        </Label>
        <Select
          value={activeVariantValue || undefined}
          onValueChange={(v) => handleVariantSwitch(v as string)}
        >
          <SelectTrigger size="sm" className="w-full max-w-md text-xs">
            <SelectValue placeholder={t("selectVariant")} />
          </SelectTrigger>
          <SelectContent>
            {variants.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeVariant?.fields && activeVariant.fields.length > 0 && (
          <div className="ml-3 pl-3 mt-2 border-l border-[var(--border-subtle)]">
            <SchemaForm
              fields={activeVariant.fields}
              values={objValue}
              onChange={(childKey, childValue) => {
                onChange(`${prefix}${field.key}.${childKey}`, childValue);
              }}
              prefix={`${prefix}${field.key}.`}
            />
          </div>
        )}
      </div>
    );
  }

  // Simple type union: variants have a `type` field (string/number/boolean)
  const currentType =
    typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
  const selectedType =
    variants.find((v) => v.type === currentType)?.type ?? variants[0]?.type ?? "string";

  const handleTypeSwitch = (newType: string) => {
    // Provide a default value for the new type
    switch (newType) {
      case "number":
        onChange(field.key, 0);
        break;
      case "boolean":
        onChange(field.key, false);
        break;
      default:
        onChange(field.key, "");
    }
  };

  const handleSimpleChange = (v: string) => {
    if (selectedType === "number") {
      onChange(field.key, Number(v) || 0);
    } else if (selectedType === "boolean") {
      onChange(field.key, v === "true");
    } else {
      onChange(field.key, v);
    }
  };

  return (
    <div className="mb-3">
      <Label className="text-xs text-[var(--text-secondary)] mb-1">
        <span className="font-mono">{field.key}</span>
        {field.required && <span className="text-[var(--danger)]"> *</span>}
        {field.description && (
          <span className="ml-1.5 font-normal opacity-70">— {field.description}</span>
        )}
      </Label>
      <div className="flex gap-2 max-w-md">
        <Select value={selectedType} onValueChange={(v) => handleTypeSwitch(v as string)}>
          <SelectTrigger size="sm" className="w-28 text-xs">
            <SelectValue placeholder={t("selectType")} />
          </SelectTrigger>
          <SelectContent>
            {variants.map((v) => (
              <SelectItem key={v.value} value={v.type ?? v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type={selectedType === "number" ? "number" : "text"}
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          onChange={(e) => handleSimpleChange(e.target.value)}
          className="flex-1 text-xs h-7 font-mono"
        />
      </div>
    </div>
  );
}
