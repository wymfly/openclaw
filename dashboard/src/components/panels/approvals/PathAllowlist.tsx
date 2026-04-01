"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

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
      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
        {t("pathAllowlist")}
      </label>

      {/* Existing paths */}
      <div className="space-y-1">
        {paths.map((path) => (
          <div
            key={path}
            className="flex items-center gap-2 px-2 py-1 rounded text-xs"
            style={{ backgroundColor: "var(--background)" }}
          >
            <code className="flex-1 truncate" style={{ color: "var(--foreground)" }}>
              {path}
            </code>
            <button
              onClick={() => handleRemove(path)}
              className="text-xs px-1 cursor-pointer shrink-0"
              style={{ color: "var(--status-disconnected)" }}
            >
              {t("removePath")}
            </button>
          </div>
        ))}
      </div>

      {/* Add new path */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="/path/to/allow"
          className="flex-1 text-xs rounded px-2 py-1 border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newPath.trim()}
          className="text-xs px-3 py-1 rounded border cursor-pointer"
          style={{
            borderColor: "var(--primary)",
            color: "var(--primary)",
            backgroundColor: "transparent",
            opacity: newPath.trim() ? 1 : 0.5,
          }}
        >
          {t("addPath")}
        </button>
      </div>
    </div>
  );
}
