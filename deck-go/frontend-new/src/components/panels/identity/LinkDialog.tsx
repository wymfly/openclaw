import { useCallback, useEffect, useState, type FormEvent } from "react";
import { IconHash, IconLink, IconX } from "../../../design-system/icons";
import { PanelPill } from "../../../design-system/patterns";
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
  defaultCanonical: string;
  configHash: string;
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
    if (props.open) {
      setDraft({ canonical: props.defaultCanonical, channel: "", peerId: "" });
    } else {
      setDraft({ canonical: "", channel: "", peerId: "" });
    }
  }, [props.defaultCanonical, props.open]);

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
    <div className="identity-panel__dialog-backdrop" role="presentation">
      <form
        aria-label={t("dialogTitle")}
        className="identity-panel__dialog"
        role="dialog"
        onSubmit={handleSubmit}
      >
        <header className="identity-panel__dialog-header">
          <div>
            <h3>
              <IconLink size={15} />
              <span>{t("dialogTitle")}</span>
            </h3>
            <p>{t("dialogDescription")}</p>
          </div>
          <button
            aria-label={tc("cancel")}
            className="identity-panel__button identity-panel__button--icon"
            type="button"
            onClick={props.onClose}
          >
            <IconX size={14} />
          </button>
        </header>

        {props.error ? <p className="identity-panel__error">{props.error}</p> : null}

        <div className={`identity-panel__guard ${props.configHash ? "is-ready" : "is-blocked"}`}>
          <div>
            <strong>{t("baseHashCommit")}</strong>
            <p>
              {props.configHash
                ? t("mutationSafetyDescription", { hash: props.configHash })
                : t("mutationSafetyBlocked")}
            </p>
          </div>
          <PanelPill tone={props.configHash ? "positive" : "warning"}>
            <IconHash size={12} />
            {props.configHash || t("hashMissing")}
          </PanelPill>
        </div>

        <label className="identity-panel__field">
          <span>{t("canonical")}</span>
          <input
            aria-label="identity canonical"
            className="identity-panel__input"
            placeholder={t("canonicalPlaceholder")}
            value={draft.canonical}
            onChange={(event) => updateDraft("canonical", event.target.value)}
          />
        </label>

        <label className="identity-panel__field">
          <span>{t("channel")}</span>
          <input
            aria-label="identity channel"
            className="identity-panel__input"
            placeholder={t("channelPlaceholder")}
            value={draft.channel}
            onChange={(event) => updateDraft("channel", event.target.value)}
          />
        </label>

        <label className="identity-panel__field">
          <span>{t("peerId")}</span>
          <input
            aria-label="identity peer id"
            className="identity-panel__input"
            placeholder={t("peerIdPlaceholder")}
            value={draft.peerId}
            onChange={(event) => updateDraft("peerId", event.target.value)}
          />
        </label>

        <footer className="identity-panel__dialog-actions">
          <button
            className="identity-panel__button"
            disabled={props.submitting}
            type="button"
            onClick={props.onClose}
          >
            {tc("cancel")}
          </button>
          <button className="identity-panel__button is-primary" disabled={!canSubmit} type="submit">
            {props.submitting ? tc("saving") : tc("save")}
          </button>
        </footer>
      </form>
    </div>
  );
}
