import { IconX } from "../../../../design-system/icons";
import type { ChannelActionState, ChannelTranslator } from "../types";

export function LogoutDialog(props: {
  channelId: string;
  actionState: ChannelActionState;
  t: ChannelTranslator;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { channelId, actionState, t, onCancel, onConfirm } = props;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <article
        aria-label={t("logoutConfirmTitle")}
        aria-modal="true"
        className="modal"
        role="dialog"
      >
        <header className="modal__head">
          <div>
            <h2>{t("logoutConfirmTitle")}</h2>
            <p>{t("logoutConfirmDescription", { channelId })}</p>
          </div>
          <button
            aria-label={t("closeDialog")}
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={onCancel}
          >
            <IconX />
          </button>
        </header>
        <footer className="modal__foot">
          <button className="btn" type="button" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button
            className="btn btn--danger"
            type="button"
            disabled={actionState !== "idle"}
            onClick={onConfirm}
          >
            {actionState === "logging-out" ? t("loggingOut") : t("confirmLogoutAction")}
          </button>
        </footer>
      </article>
    </div>
  );
}
