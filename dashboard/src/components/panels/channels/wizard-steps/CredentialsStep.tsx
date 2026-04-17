"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CredentialField {
  key: string;
  label: string;
  /** Whether this is a secret field (password-style with show/hide toggle) */
  secret?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
}

interface CredentialsStepProps {
  fields: CredentialField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Optional description shown above the fields */
  description?: string;
}

/**
 * Reusable wizard step for entering credentials with show/hide toggle
 * for secret fields. Extracted from shared channel credential forms.
 */
export function CredentialsStep({ fields, values, onChange, description }: CredentialsStepProps) {
  const [visibleSecrets, setVisibleSecrets] = useState(new Set());

  const toggleSecret = useCallback((key: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      {description && <p className="text-xs text-[var(--muted-foreground)]">{description}</p>}
      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label className="text-xs">
            {field.label}
            {field.required && <span className="text-[var(--destructive)] ml-0.5">*</span>}
          </Label>
          <div className="relative">
            <Input
              type={field.secret && !visibleSecrets.has(field.key) ? "password" : "text"}
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder ?? ""}
              className="text-xs pr-8"
            />
            {field.secret && (
              <button
                type="button"
                onClick={() => toggleSecret(field.key)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                {visibleSecrets.has(field.key) ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
