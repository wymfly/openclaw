import type { DeckGoIdentityLink } from "../../../api";
import { useTranslations } from "../../../i18n/provider";

export function IdentityList(props: {
  links: DeckGoIdentityLink[];
  loading: boolean;
  selectedCanonical: string | null;
  onSelect: (canonical: string) => void;
  onUnlink: (canonical: string, channel: string, peerId: string) => void;
}) {
  const t = useTranslations("identity");
  const tc = useTranslations("common");

  return (
    <aside className="identity-panel__card identity-panel__inventory">
      <div className="identity-panel__card-head">
        <div>
          <h3 className="identity-panel__card-title">{t("inventory")}</h3>
          <p className="identity-panel__meta">
            {props.loading ? tc("loading") : t("relationshipInventory")}
          </p>
        </div>
        <span className="identity-panel__pill">
          {t("canonicalCount", { count: props.links.length })}
        </span>
      </div>

      <div className="identity-panel__body">
        {props.loading && props.links.length === 0 ? (
          <p className="identity-panel__empty">{tc("loading")}</p>
        ) : null}
        {!props.loading && props.links.length === 0 ? (
          <p className="identity-panel__empty">{t("noLinks")}</p>
        ) : null}
        {props.links.length > 0 ? (
          <div className="identity-panel__list">
            {props.links.map((link) => (
              <div
                key={link.canonical}
                role="button"
                tabIndex={0}
                className={`identity-panel__row ${
                  props.selectedCanonical === link.canonical ? "is-selected" : ""
                }`}
                onClick={() => props.onSelect(link.canonical)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }
                  event.preventDefault();
                  props.onSelect(link.canonical);
                }}
              >
                <span className="identity-panel__row-main">
                  <span className="identity-panel__row-head">
                    <strong>{link.canonical}</strong>
                    <span className="identity-panel__pill">
                      {t("peerCount", { count: link.peers.length })}
                    </span>
                  </span>
                  {link.peers.length > 0 ? (
                    <span className="identity-panel__pill-row">
                      {link.peers.map((peer) => (
                        <span
                          className="identity-panel__pill"
                          key={`${link.canonical}:${peer.channel}:${peer.peerId}`}
                        >
                          {peer.channel}: {peer.peerId}
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Unlink ${peer.channel}:${peer.peerId}`}
                            className="identity-panel__inline-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              props.onUnlink(link.canonical, peer.channel, peer.peerId);
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") {
                                return;
                              }
                              event.preventDefault();
                              event.stopPropagation();
                              props.onUnlink(link.canonical, peer.channel, peer.peerId);
                            }}
                          >
                            ×
                          </span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="identity-panel__meta">{t("noPeers")}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
