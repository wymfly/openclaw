import { IconX } from "../../../../design-system/icons";
import { JsonDetails } from "../../../shared/ShellComponents";
import { ChannelProbeResultBadge } from "../parts/ChannelProbeResultBadge";
import type { ChannelTranslator, DeckGoChannelTestResponse } from "../types";

export function TestResultDialog(props: {
  channelLabel: string;
  result: DeckGoChannelTestResponse;
  t: ChannelTranslator;
  onClose: () => void;
}) {
  const { channelLabel, result, t, onClose } = props;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <article
        aria-label={t("testResultDialogTitle")}
        aria-modal="true"
        className="modal"
        role="dialog"
      >
        <header className="modal__head">
          <div>
            <h2>{t("testResultDialogTitle")}</h2>
            <p>{channelLabel || result.channelId}</p>
          </div>
          <button
            aria-label={t("closeDialog")}
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={onClose}
          >
            <IconX />
          </button>
        </header>
        <div className="modal__body">
          <ChannelProbeResultBadge result={result} t={t} />
          <JsonDetails title={t("channelTestResult")} payload={result} />
        </div>
        <footer className="modal__foot">
          <button className="btn btn--primary" type="button" onClick={onClose}>
            {t("closeDialog")}
          </button>
        </footer>
      </article>
    </div>
  );
}
