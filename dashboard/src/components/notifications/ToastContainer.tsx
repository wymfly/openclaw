"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useNotificationsStore, type ToastType } from "@/stores/notifications";

const ICONS: Record<ToastType, string> = {
  info: "\u2139\uFE0F",
  success: "\u2705",
  warning: "\u26A0\uFE0F",
  error: "\u274C",
};

const BORDER_COLORS: Record<ToastType, string> = {
  info: "var(--accent)",
  success: "var(--status-connected)",
  warning: "var(--status-reconnecting)",
  error: "var(--status-disconnected)",
};

/**
 * Fixed-position toast notification container.
 * Renders in the top-right corner with enter/exit CSS transitions.
 */
export function ToastContainer() {
  const toasts = useNotificationsStore((s) => s.toasts);
  const dismissToast = useNotificationsStore((s) => s.dismissToast);
  const t = useTranslations("notifications");

  // Track which toasts are "visible" (entered) for CSS transitions.
  const [visible, setVisible] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = toasts.map((toast) => toast.id);
    // Mark new toasts as visible after a frame to trigger enter animation.
    const raf = requestAnimationFrame(() => {
      setVisible(new Set(ids));
    });
    return () => cancelAnimationFrame(raf);
  }, [toasts]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 380,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 8,
            borderLeft: `4px solid ${BORDER_COLORS[toast.type]}`,
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            pointerEvents: "auto",
            opacity: visible.has(toast.id) ? 1 : 0,
            transform: visible.has(toast.id) ? "translateX(0)" : "translateX(100%)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}
          role="alert"
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>{ICONS[toast.type]}</span>
          <span style={{ flex: 1, fontSize: 14 }}>{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "2px 4px",
              fontSize: 12,
              flexShrink: 0,
            }}
            aria-label={t("dismiss")}
          >
            {t("dismiss")}
          </button>
        </div>
      ))}
    </div>
  );
}
