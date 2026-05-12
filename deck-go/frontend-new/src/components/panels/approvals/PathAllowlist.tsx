import { PanelPill } from "../../../design-system/patterns";
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
      <p className="approvals-panel__eyebrow">{t("pathAllowlist")}</p>
      {props.paths.length > 0 ? (
        <div className="approvals-panel__chip-row">
          {props.paths.map((path) => (
            <PanelPill key={path}>
              <code>{path}</code>
              <button
                className="approvals-panel__button is-danger"
                type="button"
                onClick={() => props.onRemove(path)}
              >
                {t("removePath")}
              </button>
            </PanelPill>
          ))}
        </div>
      ) : (
        <p className="approvals-panel__note">{t("noAllowlistedPaths")}</p>
      )}
      <div className="approvals-panel__actions">
        <input
          aria-label="new approval allowlist path"
          className="approvals-panel__input"
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
          className="approvals-panel__button"
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
