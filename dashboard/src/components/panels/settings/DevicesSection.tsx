"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useDevicesSSE } from "@/hooks/useDevicesSSE";
import { useDevicesStore } from "@/stores/devices";
import { DeviceRow } from "./DeviceRow";
import { PendingRequestRow } from "./PendingRequestRow";

export function DevicesSection() {
  const t = useTranslations("devices");
  const {
    pending,
    paired,
    selfDeviceId,
    loading,
    error,
    fetchDevices,
    fetchSelfDeviceId,
    approveRequest,
    rejectRequest,
    removeDevice,
    rotateToken,
    revokeToken,
  } = useDevicesStore();

  useEffect(() => {
    void fetchDevices();
    void fetchSelfDeviceId();
  }, [fetchDevices, fetchSelfDeviceId]);

  useDevicesSSE();

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("title")}
        </h3>
        <button
          className="text-[10px] px-2 py-0.5 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          onClick={() => void fetchDevices()}
          disabled={loading}
        >
          {t("refresh")}
        </button>
      </div>

      {error && (
        <div
          className="mb-3 px-3 py-2 text-xs rounded-md"
          style={{ color: "var(--destructive)", backgroundColor: "var(--destructive-muted)" }}
        >
          {error}
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="mb-4">
          <h4
            className="text-[10px] font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t("pending")} ({pending.length})
          </h4>
          <div className="space-y-1.5">
            {pending.map((req) => (
              <PendingRequestRow
                key={req.requestId}
                request={req}
                onApprove={approveRequest}
                onReject={rejectRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paired devices */}
      {paired.length > 0 ? (
        <div>
          <h4
            className="text-[10px] font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t("paired")} ({paired.length})
          </h4>
          <div className="space-y-1">
            {paired.map((device) => (
              <DeviceRow
                key={device.deviceId}
                device={device}
                isSelf={device.deviceId === selfDeviceId}
                onRemove={removeDevice}
                onRotate={rotateToken}
                onRevoke={revokeToken}
              />
            ))}
          </div>
        </div>
      ) : (
        !loading && (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("empty")}
          </p>
        )
      )}
    </section>
  );
}
