"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import type { InventoryPluginEntry } from "@/stores/plugins";
import {
  navigateToChannel,
  navigateToChannelAccess,
  navigateToRouting,
} from "../../../lib/panel-navigation";
import { useChannelsStore } from "../../../stores/channels";
import { usePluginsStore } from "../../../stores/plugins";
import { PanelEmptyState } from "../../ui/panel-empty-state";
import { PanelSkeleton } from "../../ui/panel-skeleton";
import { hasDedicatedAccessSurface } from "../channels/channel-access-registry";

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: "var(--muted-foreground)" }}>{label}:</span>{" "}
      <span style={{ color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}

function PluginCard({
  plugin,
  selected,
  onSelect,
  t,
  availableChannels,
}: {
  plugin: InventoryPluginEntry;
  selected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof useTranslations>;
  availableChannels: Set<string>;
}) {
  const visibleChannels = plugin.channelIds.filter((channelId) => availableChannels.has(channelId));
  const hiddenChannels = plugin.channelIds.filter((channelId) => !availableChannels.has(channelId));
  const accessChannels = visibleChannels.filter((channelId) =>
    hasDedicatedAccessSurface(channelId),
  );
  const routingChannelId = visibleChannels[0] ?? plugin.channelIds[0];

  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{
        borderColor: selected ? "var(--primary)" : "var(--border)",
        backgroundColor: selected ? "var(--primary-muted)" : "var(--card)",
      }}
    >
      <button onClick={onSelect} className="w-full text-left">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
              {plugin.name}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
              {plugin.id}
            </p>
          </div>
          <div className="text-right text-xs" style={{ color: "var(--muted-foreground)" }}>
            <ValueRow label={t("origin")} value={plugin.origin} />
            <ValueRow label={t("status")} value={plugin.status} />
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <ValueRow
            label={t("capabilities")}
            value={plugin.capabilityKinds.length ? plugin.capabilityKinds.join(", ") : t("none")}
          />
          <ValueRow
            label={t("channels")}
            value={plugin.channelIds.length ? plugin.channelIds.join(", ") : t("none")}
          />
          <ValueRow label={t("enabled")} value={plugin.enabled ? t("yes") : t("no")} />
          <ValueRow label={t("configPath")} value={plugin.configPath} />
        </div>
      </button>

      {plugin.channelIds.length > 0 && (
        <div
          className="mt-3 rounded-md px-3 py-2 text-xs"
          style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
        >
          <p className="font-medium">{t("relatedChannels")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleChannels.length > 0 ? (
              visibleChannels.map((channelId) => (
                <button
                  key={`${plugin.id}-channel-${channelId}`}
                  type="button"
                  className="rounded-md border px-2 py-1 transition-opacity hover:opacity-80"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                  onClick={() => navigateToChannel(channelId)}
                >
                  {t("openChannel", { channel: channelId })}
                </button>
              ))
            ) : (
              <span style={{ color: "var(--muted-foreground)" }}>{t("noVisibleChannels")}</span>
            )}
            {accessChannels.map((channelId) => (
              <button
                key={`${plugin.id}-access-${channelId}`}
                type="button"
                className="rounded-md border px-2 py-1 transition-opacity hover:opacity-80"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                onClick={() => navigateToChannelAccess(channelId)}
              >
                {t("openAccess")}
              </button>
            ))}
            <button
              type="button"
              className="rounded-md border px-2 py-1 transition-opacity hover:opacity-80"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
              onClick={() =>
                navigateToRouting(routingChannelId ? { channelId: routingChannelId } : undefined)
              }
            >
              {t("openRouting")}
            </button>
          </div>
          {hiddenChannels.length > 0 && (
            <p className="mt-2" style={{ color: "var(--warning-muted-text)" }}>
              {t("channelVisibilityWarning", { channels: hiddenChannels.join(", ") })}
            </p>
          )}
        </div>
      )}

      {(plugin.activationSource || plugin.activationReason) && (
        <div
          className="mt-3 rounded-md px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--foreground)",
          }}
        >
          <p className="font-medium">{t("activation")}</p>
          {plugin.activationSource && (
            <p className="mt-1">
              <span style={{ color: "var(--muted-foreground)" }}>{t("activationSource")}:</span>{" "}
              {plugin.activationSource}
            </p>
          )}
          {plugin.activationReason && (
            <p className="mt-1">
              <span style={{ color: "var(--muted-foreground)" }}>{t("activationReason")}:</span>{" "}
              {plugin.activationReason}
            </p>
          )}
        </div>
      )}

      {plugin.diagnostics.length > 0 && (
        <div
          className="mt-3 rounded-md px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--warning-muted)",
            color: "var(--warning-muted-text)",
          }}
        >
          <p className="font-medium">{t("diagnostics")}</p>
          <ul className="mt-1 space-y-1">
            {plugin.diagnostics.map((diag, index) => (
              <li key={`${plugin.id}-${diag.level}-${index}`}>
                [{diag.level}] {diag.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PluginsPanel() {
  const t = useTranslations("pluginsInventory");
  const { loading, error, scope, plugins, selectedId, fetchPlugins, selectPlugin } =
    usePluginsStore();
  const availableChannels = useChannelsStore((s) => new Set(s.channelOrder));
  const scopeLabel = scope === "channel" ? t("scopeChannel") : scope;

  useEffect(() => {
    void fetchPlugins();
  }, [fetchPlugins]);

  return (
    <div
      className="flex h-full flex-col rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("description")}
        </p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {t("scope")}: {scopeLabel}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && plugins.length === 0 && <PanelSkeleton variant="list" />}
        {!loading && !error && plugins.length === 0 && <PanelEmptyState title={t("empty")} />}
        {error && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--destructive-muted)", color: "var(--destructive)" }}
          >
            {error}
          </div>
        )}
        {plugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            selected={selectedId === plugin.id}
            onSelect={() => selectPlugin(plugin.id)}
            t={t}
            availableChannels={availableChannels}
          />
        ))}
      </div>
    </div>
  );
}
