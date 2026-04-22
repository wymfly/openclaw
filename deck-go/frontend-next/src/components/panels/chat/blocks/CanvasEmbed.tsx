"use client";

import { ExternalLink, FileCode, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deckFetch } from "@/lib/deck-client";
import type { ContentBlock } from "@/stores/chat-types";

type CanvasBlock = Extract<ContentBlock, { type: "canvas" }>;

interface CanvasEmbedProps {
  block: CanvasBlock;
}

// ---------------------------------------------------------------------------
// Embed sandbox modes — mirrors upstream ui/src/ui/embed-sandbox.ts
// ---------------------------------------------------------------------------

type EmbedSandboxMode = "strict" | "scripts" | "trusted";

function resolveEmbedSandbox(mode: EmbedSandboxMode | null | undefined): string {
  switch (mode) {
    case "strict":
      return "";
    case "trusted":
      return "allow-scripts allow-same-origin";
    case "scripts":
    default:
      return "allow-scripts";
  }
}

function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Gateway embed config — fetched once per session
// ---------------------------------------------------------------------------

interface EmbedConfig {
  embedSandbox: EmbedSandboxMode;
  allowExternalEmbedUrls: boolean;
}

let cachedConfig: EmbedConfig | null = null;

async function fetchEmbedConfig(): Promise<EmbedConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  try {
    const res = await deckFetch("/api/config/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keys: ["gateway.controlUi.embedSandbox", "gateway.controlUi.allowExternalEmbedUrls"],
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      const values = (data.values ?? data) as Record<string, unknown>;
      cachedConfig = {
        embedSandbox: (values["gateway.controlUi.embedSandbox"] as EmbedSandboxMode) ?? "scripts",
        allowExternalEmbedUrls: values["gateway.controlUi.allowExternalEmbedUrls"] === true,
      };
      return cachedConfig;
    }
  } catch {
    // Fall through to defaults
  }
  return { embedSandbox: "scripts", allowExternalEmbedUrls: false };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CanvasEmbed({ block }: CanvasEmbedProps) {
  const t = useTranslations("chat");
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<EmbedConfig>({
    embedSandbox: "scripts",
    allowExternalEmbedUrls: false,
  });

  useEffect(() => {
    void fetchEmbedConfig().then(setConfig);
  }, []);

  const onLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const external = useMemo(
    () => isExternalUrl(block.url) && !block.url.startsWith("/"),
    [block.url],
  );
  const blocked = external && !config.allowExternalEmbedUrls;
  const sandbox = resolveEmbedSandbox(config.embedSandbox);
  const height = block.preferredHeight ?? 320;
  const title = block.title ?? t("embedUntitled");

  if (blocked) {
    return (
      <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-muted)] p-3">
        <div className="flex items-center gap-2 text-xs text-[var(--warning-muted-text)]">
          <FileCode size={14} />
          <span>{t("embedExternalBlocked")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--muted)]">
        <FileCode size={12} className="text-[var(--muted-foreground)]" />
        <span className="text-[11px] font-medium text-[var(--foreground)] truncate flex-1">
          {title}
        </span>
        {external && (
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* Iframe container */}
      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-[var(--muted-foreground)]" />
            <span className="ml-2 text-xs text-[var(--muted-foreground)]">{t("embedLoading")}</span>
          </div>
        )}
        <iframe
          src={block.url}
          title={title}
          sandbox={sandbox}
          className="w-full h-full border-0"
          onLoad={onLoad}
          {...(external ? { referrerPolicy: "no-referrer" } : {})}
        />
      </div>
    </div>
  );
}
