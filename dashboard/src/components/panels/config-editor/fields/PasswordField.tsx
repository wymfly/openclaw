"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/schema-parser";

interface PasswordFieldProps {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}

export function PasswordField({ field, value, onChange }: PasswordFieldProps) {
  const t = useTranslations("config");
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3">
      <Label className="text-xs text-[var(--text-secondary)] mb-1">
        <span className="font-mono">{field.key}</span>
        {field.required && <span className="text-[var(--danger)]"> *</span>}
        {field.description && (
          <span className="ml-1.5 font-normal opacity-70">— {field.description}</span>
        )}
      </Label>
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
          className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {visible ? <EyeOff size={12} /> : <Eye size={12} />}
          <span>{visible ? t("hidePassword") : t("showPassword")}</span>
        </button>
      </div>
    </div>
  );
}
