"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface KvRow {
  id: number;
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  disabled?: boolean;
}

function toRows(record: Record<string, string>, counter: { current: number }): KvRow[] {
  return Object.entries(record).map(([k, v]) => ({
    id: counter.current++,
    key: k,
    value: v,
  }));
}

function toRecord(rows: KvRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (row.key || row.value) {
      out[row.key] = row.value;
    }
  }
  return out;
}

export function KeyValueEditor({ value, onChange, disabled }: KeyValueEditorProps) {
  const t = useTranslations("models");
  const idCounter = useRef(0);
  const [rows, setRows] = useState<KvRow[]>(() => toRows(value, idCounter));

  // Sync from parent when value identity changes (provider switch)
  const prevValueRef = useRef(value);
  if (value !== prevValueRef.current) {
    prevValueRef.current = value;
    const currentRecord = toRecord(rows);
    const same =
      Object.keys(value).length === Object.keys(currentRecord).length &&
      Object.entries(value).every(([k, v]) => currentRecord[k] === v);
    if (!same) {
      setRows(toRows(value, idCounter));
    }
  }

  const emit = useCallback(
    (nextRows: KvRow[]) => {
      setRows(nextRows);
      onChange(toRecord(nextRows));
    },
    [onChange],
  );

  const handleKeyChange = useCallback(
    (id: number, newKey: string) => {
      emit(rows.map((r) => (r.id === id ? { ...r, key: newKey } : r)));
    },
    [rows, emit],
  );

  const handleValueChange = useCallback(
    (id: number, newValue: string) => {
      emit(rows.map((r) => (r.id === id ? { ...r, value: newValue } : r)));
    },
    [rows, emit],
  );

  const handleRemove = useCallback(
    (id: number) => {
      emit(rows.filter((r) => r.id !== id));
    },
    [rows, emit],
  );

  const handleAdd = useCallback(() => {
    emit([...rows, { id: idCounter.current++, key: "", value: "" }]);
  }, [rows, emit]);

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <Input
            className="flex-1 h-8 text-sm"
            placeholder={t("kv.keyPlaceholder")}
            value={row.key}
            onChange={(e) => handleKeyChange(row.id, e.target.value)}
            disabled={disabled}
          />
          <Input
            className="flex-1 h-8 text-sm"
            placeholder={t("kv.valuePlaceholder")}
            value={row.value}
            onChange={(e) => handleValueChange(row.id, e.target.value)}
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:text-destructive"
            onClick={() => handleRemove(row.id)}
            disabled={disabled}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={handleAdd}
        disabled={disabled}
      >
        {t("kv.addRow")}
      </Button>
    </div>
  );
}
