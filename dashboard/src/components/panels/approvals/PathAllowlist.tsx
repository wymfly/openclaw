"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PathAllowlistProps {
  paths: string[];
  onChange: (paths: string[]) => void;
}

/**
 * PathAllowlist — editable list of allowed paths with add/remove.
 */
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
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{t("pathAllowlist")}</Label>

      {/* Existing paths */}
      <div className="space-y-1">
        {paths.map((path) => (
          <div key={path} className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted text-xs">
            <code className="flex-1 truncate text-foreground">{path}</code>
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive hover:text-destructive shrink-0 h-5 px-1"
              onClick={() => handleRemove(path)}
            >
              {t("removePath")}
            </Button>
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
          className="flex-1 h-7 text-xs"
        />
        <Button variant="outline" size="xs" onClick={handleAdd} disabled={!newPath.trim()}>
          {t("addPath")}
        </Button>
      </div>
    </div>
  );
}
