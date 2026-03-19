"use client";

import { Info, CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useNotificationsStore, type ToastType } from "@/stores/notifications";

/* ------------------------------------------------------------------ */
/*  Toast type config                                                  */
/* ------------------------------------------------------------------ */

const TOAST_CONFIG: Record<
  ToastType,
  { icon: React.ReactNode; accent: string; bg: string; ring: string }
> = {
  info: {
    icon: <Info size={15} className="shrink-0 text-[var(--accent)]" />,
    accent: "border-l-[var(--accent)]",
    bg: "bg-[var(--bg-secondary)]",
    ring: "ring-[var(--border)]",
  },
  success: {
    icon: <CheckCircle size={15} className="shrink-0 text-[var(--success)]" />,
    accent: "border-l-[var(--success)]",
    bg: "bg-[var(--bg-secondary)]",
    ring: "ring-[var(--success)]/20",
  },
  warning: {
    icon: <AlertTriangle size={15} className="shrink-0 text-[var(--warning)]" />,
    accent: "border-l-[var(--warning)]",
    bg: "bg-[var(--bg-secondary)]",
    ring: "ring-[var(--warning)]/20",
  },
  error: {
    icon: <XCircle size={15} className="shrink-0 text-[var(--danger)]" />,
    accent: "border-l-[var(--danger)]",
    bg: "bg-[var(--bg-secondary)]",
    ring: "ring-[var(--danger)]/20",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fixed-position toast notification container.
 * Renders in the top-right corner with enter/exit CSS transitions.
 */
export function ToastContainer() {
  const toasts = useNotificationsStore((s) => s.toasts);
  const dismissToast = useNotificationsStore((s) => s.dismissToast);
  const t = useTranslations("notifications");

  const [visible, setVisible] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = toasts.map((toast) => toast.id);
    const raf = requestAnimationFrame(() => {
      setVisible(new Set(ids));
    });
    return () => cancelAnimationFrame(raf);
  }, [toasts]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex max-w-[380px] flex-col gap-2">
      {toasts.map((toast) => {
        const cfg = TOAST_CONFIG[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 rounded-xl border-l-[3px] px-3.5 py-3 text-[var(--text-primary)] shadow-lg ring-1 transition-all duration-300 ease-out",
              cfg.accent,
              cfg.bg,
              cfg.ring,
              visible.has(toast.id) ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
            )}
            role="alert"
          >
            {cfg.icon}
            <span className="flex-1 text-sm leading-snug">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
              aria-label={t("dismiss")}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
