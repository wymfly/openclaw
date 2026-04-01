"use client";

import {
  Bot,
  Brain,
  FileText,
  Globe,
  Lock,
  RefreshCw,
  Server,
  Share2,
  Webhook,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { SECTION_META } from "@/lib/section-metadata";

/** Static icon map — avoids dynamic import of lucide icons */
const ICON_MAP: Record<string, ComponentType<{ size?: number }>> = {
  Bot,
  Brain,
  FileText,
  Globe,
  Lock,
  RefreshCw,
  Server,
  Share2,
  Webhook,
  Wrench,
};

interface SectionIntroCardProps {
  sectionKey: string;
}

/**
 * Contextual intro card displayed above SchemaForm for known config sections.
 * Shows icon, title, description, and a docs link.
 * Returns null for unknown sections (graceful degradation).
 */
export function SectionIntroCard({ sectionKey }: SectionIntroCardProps) {
  const t = useTranslations("config");

  // For dotted paths like "agents.main", use the top-level segment for metadata lookup
  const topLevel = sectionKey.split(".")[0];
  const meta = SECTION_META[topLevel];

  if (!meta) {
    return null;
  }

  const Icon = ICON_MAP[meta.icon];

  return (
    <div
      className="flex items-start gap-3 rounded-lg px-4 py-3 mb-3 border"
      style={{
        backgroundColor: "color-mix(in srgb, var(--primary) 8%, var(--card))",
        borderColor: "color-mix(in srgb, var(--primary) 20%, var(--border))",
      }}
    >
      {/* Icon */}
      {Icon && (
        <div className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }}>
          <Icon size={16} />
        </div>
      )}

      {/* Title + Description */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {t(meta.titleKey)}
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
          {t(meta.descriptionKey)}
        </div>
      </div>

      {/* Docs link */}
      <a
        href={meta.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs hover:underline mt-0.5"
        style={{ color: "var(--primary)" }}
      >
        {t("viewDocs")} &rarr;
      </a>
    </div>
  );
}
