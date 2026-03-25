"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { useChannelsStore } from "@/stores/channels";
import { DmPolicySelector } from "./DmPolicySelector";
import { RetryStrategyEditor } from "./RetryStrategyEditor";

interface ChannelSettingsTabProps {
  channelId: string;
}

interface RetryState {
  attempts: number;
  minDelayMs: number;
  maxDelayMs: number;
  jitter: number;
}

const DEFAULT_RETRY: RetryState = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: 0.2,
};

export function ChannelSettingsTab({ channelId }: ChannelSettingsTabProps) {
  const t = useTranslations("channels.settings");
  const tc = useTranslations("common");

  const { channelConfig, fetchChannelConfig, saveChannelConfig } = useChannelsStore();

  const [dmPolicy, setDmPolicy] = useState("pairing");
  const [retry, setRetry] = useState<RetryState>(DEFAULT_RETRY);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Initial values for reset
  const [initialDmPolicy, setInitialDmPolicy] = useState("pairing");
  const [initialRetry, setInitialRetry] = useState<RetryState>(DEFAULT_RETRY);

  // Fetch config on mount
  useEffect(() => {
    void fetchChannelConfig(channelId);
  }, [channelId, fetchChannelConfig]);

  // Populate local state from fetched config
  useEffect(() => {
    if (!channelConfig) return;

    const cfg = channelConfig as Record<string, unknown>;
    const policy = typeof cfg.dmPolicy === "string" ? cfg.dmPolicy : "pairing";
    const retryObj = (cfg.retry ?? {}) as Record<string, unknown>;

    const retryState: RetryState = {
      attempts: typeof retryObj.attempts === "number" ? retryObj.attempts : DEFAULT_RETRY.attempts,
      minDelayMs:
        typeof retryObj.minDelayMs === "number" ? retryObj.minDelayMs : DEFAULT_RETRY.minDelayMs,
      maxDelayMs:
        typeof retryObj.maxDelayMs === "number" ? retryObj.maxDelayMs : DEFAULT_RETRY.maxDelayMs,
      jitter: typeof retryObj.jitter === "number" ? retryObj.jitter : DEFAULT_RETRY.jitter,
    };

    setDmPolicy(policy);
    setRetry(retryState);
    setInitialDmPolicy(policy);
    setInitialRetry(retryState);
    setDirty(false);
    setLoaded(true);
  }, [channelConfig]);

  const handleDmPolicyChange = useCallback((policy: string) => {
    setDmPolicy(policy);
    setDirty(true);
  }, []);

  const handleRetryChange = useCallback((field: string, value: number) => {
    setRetry((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        dmPolicy,
        retry: {
          attempts: retry.attempts,
          minDelayMs: retry.minDelayMs,
          maxDelayMs: retry.maxDelayMs,
          jitter: retry.jitter,
        },
      };
      const ok = await saveChannelConfig(channelId, patch);
      if (ok) {
        setInitialDmPolicy(dmPolicy);
        setInitialRetry({ ...retry });
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }, [channelId, dmPolicy, retry, saveChannelConfig]);

  const handleReset = useCallback(() => {
    setDmPolicy(initialDmPolicy);
    setRetry({ ...initialRetry });
    setDirty(false);
  }, [initialDmPolicy, initialRetry]);

  if (!loaded) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
        {tc("loading")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        <DmPolicySelector value={dmPolicy} onChange={handleDmPolicyChange} />
        <RetryStrategyEditor
          attempts={retry.attempts}
          minDelayMs={retry.minDelayMs}
          maxDelayMs={retry.maxDelayMs}
          jitter={retry.jitter}
          onChange={handleRetryChange}
        />
      </div>

      {/* Save/Reset bar */}
      {dirty && (
        <div
          className="shrink-0 flex items-center justify-end gap-2 px-4 py-2 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={handleReset}
            className="text-xs px-3 py-1 rounded transition-opacity hover:opacity-80"
            style={{
              border: "1px solid var(--border)",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--background)",
            }}
          >
            {t("reset")}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="text-xs px-3 py-1 rounded transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            {saving ? tc("loading") : tc("save")}
          </button>
        </div>
      )}
    </div>
  );
}
