"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface InlineEditTextProps {
  type?: "text";
  /** Current value displayed in read-only mode. */
  value: string;
  /** Called with new value when user confirms. */
  onConfirm: (value: string) => void;
  /** Optional placeholder for empty value. */
  placeholder?: string;
  /** Optional className for the outer container. */
  className?: string;
}

interface InlineEditSelectProps {
  type: "select";
  /** Current value displayed in read-only mode. */
  value: string;
  /** Called with new value when user confirms. */
  onConfirm: (value: string) => void;
  /** Options for select mode. */
  options: { value: string; label: string }[];
  /** Optional className for the outer container. */
  className?: string;
}

type InlineEditProps = InlineEditTextProps | InlineEditSelectProps;

export function InlineEdit(props: InlineEditProps) {
  const { value, onConfirm, className } = props;
  const t = useTranslations("lists");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Sync draft when value changes externally
  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  // Auto-focus on edit start
  useEffect(() => {
    if (editing) {
      if (props.type === "select") {
        selectRef.current?.focus();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [editing, props.type]);

  const startEdit = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const confirm = useCallback(() => {
    setEditing(false);
    if (draft !== value) {
      onConfirm(draft);
    }
  }, [draft, value, onConfirm]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [confirm, cancel],
  );

  // ----- Read-only mode -----
  if (!editing) {
    const displayValue =
      props.type === "select"
        ? (props.options.find((o) => o.value === value)?.label ?? value)
        : value;

    const placeholder = props.type !== "select" && props.placeholder ? props.placeholder : "—";

    return (
      <button
        type="button"
        onClick={startEdit}
        className={cn(
          "group inline-flex items-center gap-1.5 text-sm cursor-pointer",
          "hover:text-primary transition-colors",
          className,
        )}
        title={t("inlineEditConfirm")}
      >
        <span className={cn(!displayValue && "text-muted-foreground italic")}>
          {displayValue || placeholder}
        </span>
        <Pencil
          size={12}
          className="opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground"
        />
      </button>
    );
  }

  // ----- Edit mode: select -----
  if (props.type === "select") {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <select
          ref={selectRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setEditing(false);
            if (e.target.value !== value) {
              onConfirm(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          onBlur={cancel}
          className="text-sm bg-transparent border border-primary rounded px-1.5 py-0.5 outline-none text-foreground"
        >
          {props.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // ----- Edit mode: text -----
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={cancel}
        className="text-sm bg-transparent border border-primary rounded px-1.5 py-0.5 outline-none text-foreground min-w-[80px]"
      />
    </div>
  );
}
