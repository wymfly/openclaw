"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/schema-parser";
import { SchemaForm } from "../SchemaForm";

interface TypedArrayFieldProps {
  field: FormField;
  value: unknown[];
  onChange: (v: unknown[]) => void;
  prefix: string;
}

export function TypedArrayField({ field, value, onChange, prefix }: TypedArrayFieldProps) {
  const t = useTranslations("config");
  const items = Array.isArray(value) ? value : [];
  const itemSchema = field.itemSchema;
  const isObjectItem = itemSchema?.type === "object" && itemSchema.children;

  const handleAdd = () => {
    const newItem = isObjectItem ? {} : "";
    onChange([...items, newItem]);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) {
      return;
    }
    const updated = [...items];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  };

  const handleItemChange = (index: number, newValue: unknown) => {
    const updated = [...items];
    updated[index] = newValue;
    onChange(updated);
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
        {items.map((item, index) => (
          <div
            key={index}
            className="group rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-2"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                {t("itemIndex", { index: index + 1 })}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  className="p-0.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                  title={t("moveUp")}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === items.length - 1}
                  className="p-0.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                  title={t("moveDown")}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="p-0.5 rounded text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
                  title={t("removeItem")}
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {isObjectItem && itemSchema?.children ? (
              <SchemaForm
                fields={itemSchema.children}
                values={(item as Record<string, unknown>) ?? {}}
                onChange={(childKey, childValue) => {
                  const updated = {
                    ...(item as Record<string, unknown>),
                    [childKey]: childValue,
                  };
                  handleItemChange(index, updated);
                }}
                prefix={`${prefix}${field.key}[${index}].`}
              />
            ) : (
              <Input
                type={itemSchema?.type === "number" ? "number" : "text"}
                value={item != null ? JSON.stringify(item) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (itemSchema?.type === "number") {
                    handleItemChange(index, Number(v) || 0);
                  } else {
                    handleItemChange(index, v);
                  }
                }}
                className="w-full text-xs h-7 font-mono"
              />
            )}
          </div>
        ))}

        <Button type="button" variant="ghost" size="xs" onClick={handleAdd}>
          <Plus size={12} />
          <span>{t("addItem")}</span>
        </Button>
      </div>
    </div>
  );
}
