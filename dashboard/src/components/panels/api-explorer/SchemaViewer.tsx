"use client";

import { ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";

interface SchemaViewerProps {
  schema: Record<string, unknown>;
  depth?: number;
}

const MAX_DEPTH = 5;

const TYPE_COLORS: Record<string, string> = {
  string: "var(--success)",
  number: "var(--primary)",
  integer: "var(--primary)",
  boolean: "var(--warning)",
  array: "var(--purple)",
  object: "var(--foreground)",
  null: "var(--muted-foreground)",
};

export function SchemaViewer({ schema, depth = 0 }: SchemaViewerProps) {
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const items = schema.items as Record<string, unknown> | undefined;
  const required = schema.required as string[] | undefined;
  const requiredSet = new Set(required ?? []);

  // Object with properties
  if (properties && typeof properties === "object" && depth < MAX_DEPTH) {
    return (
      <div className="space-y-0.5">
        {Object.entries(properties).map(([key, propSchema]) => (
          <PropertyRow
            key={key}
            name={key}
            schema={propSchema}
            required={requiredSet.has(key)}
            depth={depth}
          />
        ))}
      </div>
    );
  }

  // Array with items
  if (items && typeof items === "object" && depth < MAX_DEPTH) {
    return (
      <div className="flex items-start gap-1">
        <TypeBadge type="array" />
        <span className="text-[10px] text-[var(--muted-foreground)]">of</span>
        <SchemaViewer schema={items} depth={depth + 1} />
      </div>
    );
  }

  // Simple type or max depth
  return <TypeBadge type={resolveType(schema)} enumValues={resolveEnum(schema)} />;
}

function PropertyRow({
  name,
  schema,
  required,
  depth,
}: {
  name: string;
  schema: Record<string, unknown>;
  required: boolean;
  depth: number;
}) {
  const hasNestedProperties = schema.properties != null && typeof schema.properties === "object";
  const hasNestedItems = schema.items != null && typeof schema.items === "object";
  const hasChildren = hasNestedProperties || hasNestedItems;
  const [expanded, setExpanded] = useState(depth < 1);

  return (
    <div>
      <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: `${depth * 12}px` }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <span className="text-[11px] font-mono font-medium" style={{ color: "var(--foreground)" }}>
          {name}
        </span>

        {required && (
          <span className="text-[9px] font-medium" style={{ color: "var(--destructive)" }}>
            *
          </span>
        )}

        <TypeBadge type={resolveType(schema)} enumValues={resolveEnum(schema)} />
      </div>

      {hasChildren && expanded && <SchemaViewer schema={schema} depth={depth + 1} />}
    </div>
  );
}

function resolveType(schema: Record<string, unknown>): string {
  const t = schema.type;
  if (Array.isArray(t)) {
    return t.join(" | ");
  }
  if (typeof t === "string") {
    return t;
  }
  return "any";
}

function resolveEnum(schema: Record<string, unknown>): string[] | undefined {
  const e = schema.enum;
  if (!Array.isArray(e) || e.length === 0) {
    return undefined;
  }
  return e.map(String);
}

function TypeBadge({ type, enumValues }: { type?: string; enumValues?: string[] }) {
  const displayType = type ?? "any";
  const color = TYPE_COLORS[displayType] ?? "var(--muted-foreground)";

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] font-mono" style={{ color }}>
        {displayType}
      </span>
      {enumValues && (
        <span className="text-[9px] text-[var(--text-tertiary)]">[{enumValues.join(", ")}]</span>
      )}
    </span>
  );
}
