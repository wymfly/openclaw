import { useTranslations } from "../../../i18n/provider";

export function PathAllowlist(props: {
  paths: string[];
  newPath: string;
  onAdd: () => void;
  onNewPathChange: (path: string) => void;
  onRemove: (path: string) => void;
}) {
  const t = useTranslations("approvals");

  return (
    <>
      <p className="deckgo-kicker deck-ui-approvals-section-title">{t("pathAllowlist")}</p>
      {props.paths.length > 0 ? (
        <div className="deckgo-pill-row deck-ui-approvals-allowlist-row">
          {props.paths.map((path) => (
            <span key={path} className="deckgo-pill">
              <code>{path}</code>
              <button
                className="deckgo-button deck-ui-approvals-button is-danger"
                type="button"
                onClick={() => props.onRemove(path)}
              >
                {t("removePath")}
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="deckgo-note">{t("noAllowlistedPaths")}</p>
      )}
      <div className="deckgo-actions deck-ui-approvals-actions deck-ui-approvals-actions-bottom">
        <input
          aria-label="new approval allowlist path"
          className="deckgo-input deck-ui-approvals-input"
          value={props.newPath}
          onChange={(event) => props.onNewPathChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              props.onAdd();
            }
          }}
          placeholder="/path/to/allow"
        />
        <button
          className="deckgo-button deck-ui-approvals-button"
          type="button"
          onClick={props.onAdd}
          disabled={!props.newPath.trim()}
        >
          {t("addPathAction")}
        </button>
      </div>
    </>
  );
}
