"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { FormField } from "@/lib/schema-parser";
import { FieldLabel, SchemaForm } from "../SchemaForm";

interface RecordFieldProps {
  field: FormField;
  value: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix: string;
  searchQuery?: string;
}

export function RecordField({ field, value, onChange, prefix, searchQuery }: RecordFieldProps) {
  const t = useTranslations("config");
  const [newKey, setNewKey] = useState("");

  const entries = Object.entries(value ?? {});
  const isComplexValue = field.valueSchema && field.valueSchema.type === "object";
  const valueType = field.valueSchema?.type;

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
      <FieldLabel field={field} searchQuery={searchQuery} />

      <div className="ml-3 pl-3 border-l border-[var(--border-subtle)] space-y-2">
        {entries.map(([entryKey, entryValue]) => (
          <div key={entryKey} className="group">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--muted-foreground)] font-mono min-w-[3rem]">
                {entryKey}
              </span>
              {isComplexValue && field.valueSchema?.children ? (
                <div className="flex-1" />
              ) : valueType === "boolean" ? (
                <Switch
                  checked={Boolean(entryValue)}
                  onCheckedChange={(v) => handleValueChange(entryKey, v)}
                />
              ) : (
                <Input
                  type={valueType === "number" ? "number" : "text"}
                  value={
                    typeof entryValue === "string" ? entryValue : JSON.stringify(entryValue ?? "")
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (valueType === "number") {
                      handleValueChange(entryKey, Number(raw));
                    } else {
                      handleValueChange(entryKey, raw);
                    }
                  }}
                  className="flex-1 max-w-xs text-xs h-7 font-mono"
                  placeholder={t("entryValue")}
                />
              )}
              <button
                type="button"
                onClick={() => handleRemove(entryKey)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-all"
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
                  searchQuery={searchQuery}
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
