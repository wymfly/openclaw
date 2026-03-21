"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/schema-parser";
import { SchemaForm } from "../SchemaForm";

interface RecordFieldProps {
  field: FormField;
  value: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix: string;
}

export function RecordField({ field, value, onChange, prefix }: RecordFieldProps) {
  const t = useTranslations("config");
  const [newKey, setNewKey] = useState("");

  const entries = Object.entries(value ?? {});
  const isComplexValue = field.valueSchema && field.valueSchema.type === "object";

  const handleAdd = () => {
    const trimmed = newKey.trim();
    if (!trimmed || trimmed in (value ?? {})) {
      return;
    }

    const updated = { ...value, [trimmed]: isComplexValue ? {} : "" };
    onChange(field.key, updated);
    setNewKey("");
  };

  const handleRemove = (entryKey: string) => {
    const updated = { ...value };
    delete updated[entryKey];
    onChange(field.key, updated);
  };

  const handleValueChange = (entryKey: string, entryValue: unknown) => {
    const updated = { ...value, [entryKey]: entryValue };
    onChange(field.key, updated);
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

      <div className="ml-3 pl-3 border-l border-[var(--border-subtle)] space-y-2">
        {entries.map(([entryKey, entryValue]) => (
          <div key={entryKey} className="group">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-secondary)] font-mono min-w-[3rem]">
                {entryKey}
              </span>
              {isComplexValue && field.valueSchema?.children ? (
                <div className="flex-1" />
              ) : (
                <Input
                  type="text"
                  value={
                    typeof entryValue === "string" ? entryValue : JSON.stringify(entryValue ?? "")
                  }
                  onChange={(e) => handleValueChange(entryKey, e.target.value)}
                  className="flex-1 max-w-xs text-xs h-7 font-mono"
                  placeholder={t("entryValue")}
                />
              )}
              <button
                type="button"
                onClick={() => handleRemove(entryKey)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-secondary)] hover:text-[var(--danger)] transition-all"
                title={t("removeEntry")}
              >
                <X size={12} />
              </button>
            </div>
            {isComplexValue && field.valueSchema?.children && (
              <div className="ml-3 pl-3 mt-1 border-l border-[var(--border-subtle)]">
                <SchemaForm
                  fields={field.valueSchema.children}
                  values={(entryValue as Record<string, unknown>) ?? {}}
                  onChange={(childKey, childValue) => {
                    const newEntryValue = {
                      ...(entryValue as Record<string, unknown>),
                      [childKey]: childValue,
                    };
                    handleValueChange(entryKey, newEntryValue);
                  }}
                  prefix={`${prefix}${field.key}.${entryKey}.`}
                />
              </div>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 mt-1">
          <Input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder={t("entryKey")}
            className="max-w-[10rem] text-xs h-7 font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleAdd}
            disabled={!newKey.trim() || newKey.trim() in (value ?? {})}
          >
            <Plus size={12} />
            <span>{t("addEntry")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
