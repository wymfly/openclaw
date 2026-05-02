import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "../../../i18n/provider";

export type IdentityLinkInput = {
  canonical: string;
  channel: string;
  peerId: string;
};

export function LinkDialog(props: {
  open: boolean;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: IdentityLinkInput) => void;
}) {
  const t = useTranslations("identity");
  const tc = useTranslations("common");
  const [draft, setDraft] = useState({
    canonical: "",
    channel: "",
    peerId: "",
  });

  useEffect(() => {
    if (!props.open) {
      setDraft({ canonical: "", channel: "", peerId: "" });
    }
  }, [props.open]);

  const updateDraft = useCallback((field: keyof IdentityLinkInput, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onSubmit(draft);
  };

  const canSubmit =
    draft.canonical.trim().length > 0 &&
    draft.channel.trim().length > 0 &&
    draft.peerId.trim().length > 0 &&
    !props.submitting;

  if (!props.open) {
    return null;
  }

  return (
    <div className="deck-ui-identity-dialog-backdrop" role="presentation">
      <form
        aria-label={t("dialogTitle")}
        className="deck-ui-identity-dialog"
        onSubmit={handleSubmit}
      >
        <header className="deck-ui-identity-dialog-header">
          <div>
            <h3>{t("dialogTitle")}</h3>
            <p>{t("dialogDescription")}</p>
          </div>
          <button
            aria-label={tc("cancel")}
            className="deckgo-button deckgo-button-compact"
            type="button"
            onClick={props.onClose}
          >
            ×
          </button>
        </header>

        {props.error ? <p className="deck-ui-control-error">{props.error}</p> : null}

        <label className="deck-ui-control-field">
          <span>{t("canonical")}</span>
          <input
            aria-label="identity canonical"
            className="deck-ui-identity-input"
            placeholder={t("canonicalPlaceholder")}
            value={draft.canonical}
            onChange={(event) => updateDraft("canonical", event.target.value)}
          />
        </label>

        <label className="deck-ui-control-field">
          <span>{t("channel")}</span>
          <input
            aria-label="identity channel"
            className="deck-ui-identity-input"
            placeholder={t("channelPlaceholder")}
            value={draft.channel}
            onChange={(event) => updateDraft("channel", event.target.value)}
          />
        </label>

        <label className="deck-ui-control-field">
          <span>{t("peerId")}</span>
          <input
            aria-label="identity peer id"
            className="deck-ui-identity-input"
            placeholder={t("peerIdPlaceholder")}
            value={draft.peerId}
            onChange={(event) => updateDraft("peerId", event.target.value)}
          />
        </label>

        <footer className="deck-ui-identity-dialog-actions">
          <button
            className="deckgo-button deck-ui-identity-button"
            disabled={props.submitting}
            type="button"
            onClick={props.onClose}
          >
            {tc("cancel")}
          </button>
          <button
            className="deckgo-button is-primary deck-ui-identity-button"
            disabled={!canSubmit}
            type="submit"
          >
            {props.submitting ? tc("saving") : tc("save")}
          </button>
        </footer>
      </form>
    </div>
  );
}
