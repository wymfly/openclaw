"use client";

import { Info, CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useNotificationsStore, type ToastType } from "@/stores/notifications";

const ICONS: Record<ToastType, React.ReactNode> = {
  info: <Info size={16} className="shrink-0 text-primary" />,
  success: <CheckCircle size={16} className="shrink-0 text-[var(--success)]" />,
  warning: <AlertTriangle size={16} className="shrink-0 text-[var(--warning)]" />,
  error: <XCircle size={16} className="shrink-0 text-destructive" />,
};

const BORDER_CLASSES: Record<ToastType, string> = {
  info: "border-l-primary",
  success: "border-l-[var(--success)]",
  warning: "border-l-[var(--warning)]",
  error: "border-l-destructive",
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
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex max-w-[380px] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-center gap-2.5 rounded-lg border-l-4 bg-card px-3.5 py-2.5 text-card-foreground shadow-lg ring-1 ring-foreground/10 transition-all duration-300 ease-out",
            BORDER_CLASSES[toast.type],
            visible.has(toast.id) ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
          )}
          role="alert"
        >
          {ICONS[toast.type]}
          <span className="flex-1 text-sm">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t("dismiss")}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
