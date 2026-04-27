import { useTranslations } from "../../i18n/provider";
import { useNotificationsStore, type ToastType } from "../../stores/notifications";

const toastLabels: Record<ToastType, string> = {
  error: "error",
  info: "info",
  success: "success",
  warning: "warning",
};

export function ToastContainer() {
  const t = useTranslations("notifications");
  const toasts = useNotificationsStore((state) => state.toasts);
  const dismissToast = useNotificationsStore((state) => state.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="deckgo-toast-region" role="region" aria-label={t("regionLabel")}>
      {toasts.map((toast) => (
        <article className={`deckgo-toast is-${toast.type}`} key={toast.id} role="alert">
          <span className="deckgo-toast-marker" aria-hidden="true" />
          <div>
            <p className="deckgo-toast-type">{t(toastLabels[toast.type])}</p>
            <p className="deckgo-toast-message">{toast.message}</p>
          </div>
          <button
            aria-label={t("dismiss")}
            className="deckgo-icon-button deckgo-toast-dismiss"
            onClick={() => dismissToast(toast.id)}
            type="button"
          >
            {t("dismiss")}
          </button>
        </article>
      ))}
    </div>
  );
}
