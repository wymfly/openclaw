"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PathAllowlistProps {
  paths: string[];
  onChange: (paths: string[]) => void;
}

export function PathAllowlist({ paths, onChange }: PathAllowlistProps) {
  const t = useTranslations("approvals");
  const [newPath, setNewPath] = useState("");

  const handleAdd = () => {
    const trimmed = newPath.trim();
    if (!trimmed || paths.includes(trimmed)) {
      return;
    }
    onChange([...paths, trimmed]);
    setNewPath("");
  };

  const handleRemove = (path: string) => {
    onChange(paths.filter((p) => p !== path));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2.5">
      <Label className="text-xs text-[var(--text-secondary)]">{t("pathAllowlist")}</Label>

      {/* Existing paths */}
      <div className="space-y-1">
        {paths.map((path) => (
          <div
            key={path}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)] text-xs group"
          >
            <code className="flex-1 truncate font-mono text-[var(--text-primary)]">{path}</code>
            <button
              type="button"
              className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors duration-150 cursor-pointer opacity-0 group-hover:opacity-100"
              onClick={() => handleRemove(path)}
              aria-label={t("removePath")}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new path */}
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="/path/to/allow"
          className="flex-1 h-8 text-xs font-mono"
        />
        <Button
          variant="outline"
          size="xs"
          onClick={handleAdd}
          disabled={!newPath.trim()}
          className="gap-1"
        >
          <Plus size={12} />
          {t("addPath")}
        </Button>
      </div>
    </div>
  );
}
