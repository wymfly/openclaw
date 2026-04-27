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
    <aside className="deck-ui-control-sidebar deck-ui-identity-sidebar">
      <div className="deck-ui-control-sidebar-header">
        <h2>{t("title")}</h2>
      </div>

      <div className="deck-ui-control-sidebar-scroll">
        {props.loading && props.links.length === 0 ? (
          <p className="deck-ui-control-empty">{tc("loading")}</p>
        ) : null}
        {!props.loading && props.links.length === 0 ? (
          <p className="deck-ui-control-empty">{t("noLinks")}</p>
        ) : null}
        {props.links.length > 0 ? (
          <div className="deck-ui-control-list deck-ui-identity-list">
            {props.links.map((link) => (
              <div
                key={link.canonical}
                role="button"
                tabIndex={0}
                className={`deck-ui-control-row deck-ui-identity-row ${
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
                <span className="deck-ui-control-row-main">
                  <span className="deck-ui-control-row-header">
                    <strong>{link.canonical}</strong>
                    <span className="deckgo-pill">
                      {t("peerCount", { count: link.peers.length })}
                    </span>
                  </span>
                  {link.peers.length > 0 ? (
                    <span className="deck-ui-identity-peer-pills">
                      {link.peers.map((peer) => (
                        <span
                          className="deckgo-pill"
                          key={`${link.canonical}:${peer.channel}:${peer.peerId}`}
                        >
                          {peer.channel}: {peer.peerId}
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Unlink ${peer.channel}:${peer.peerId}`}
                            className="deckgo-inline-action"
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
                    <span className="deckgo-meta">{t("noPeers")}</span>
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
