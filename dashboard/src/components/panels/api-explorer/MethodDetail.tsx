"use client";

import { useTranslations } from "next-intl";
import type { MethodInfo } from "@/stores/api-explorer";
import { SchemaViewer } from "./SchemaViewer";

interface MethodDetailProps {
  method: MethodInfo;
}

export function MethodDetail({ method }: MethodDetailProps) {
  const t = useTranslations("apiExplorer");

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold font-mono" style={{ color: "var(--foreground)" }}>
          {method.name}
        </h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full"
            style={{
              backgroundColor: "var(--primary-muted)",
              color: "var(--primary)",
            }}
          >
            {method.scope}
          </span>
          {method.since != null && (
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {t("since")} v{method.since}
            </span>
          )}
        </div>
      </div>

      {/* Params schema */}
      <SchemaSection title={t("paramsSchema")} schema={method.params} />

      {/* Result schema */}
      <SchemaSection title={t("resultSchema")} schema={method.result} />
    </div>
  );
}

function SchemaSection({ title, schema }: { title: string; schema?: Record<string, unknown> }) {
  const t = useTranslations("apiExplorer");

  return (
    <div>
      <h4 className="text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>
        {title}
      </h4>
      {schema ? (
        <div
          className="rounded-md border p-3"
          style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--muted)" }}
        >
          <SchemaViewer schema={schema} />
        </div>
      ) : (
        <p className="text-[10px] text-[var(--text-tertiary)] italic">{t("noSchema")}</p>
      )}
    </div>
  );
}
