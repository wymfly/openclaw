"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { FormField } from "@/lib/schema-parser";
import { FieldLabel } from "../SchemaForm";

interface PasswordFieldProps {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  searchQuery?: string;
}

export function PasswordField({ field, value, onChange, searchQuery }: PasswordFieldProps) {
  const t = useTranslations("config");
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3">
      <FieldLabel field={field} searchQuery={searchQuery} />
      <div className="relative w-full max-w-md">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
          className="w-full text-xs h-7 pr-16 font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          {visible ? <EyeOff size={12} /> : <Eye size={12} />}
          <span>{visible ? t("hidePassword") : t("showPassword")}</span>
        </button>
      </div>
    </div>
  );
}
