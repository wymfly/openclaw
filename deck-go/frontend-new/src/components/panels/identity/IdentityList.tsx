import type { DeckGoIdentityLink } from "../../../api";
import { IconPlus, IconRefresh, IconSearch, IconSubagents } from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";

export function IdentityList(props: {
  links: DeckGoIdentityLink[];
  loading: boolean;
  query: string;
  selectedCanonical: string | null;
  configHash: string;
  onQueryChange: (query: string) => void;
  onCreateUnsupported: () => void;
  onRefresh: () => void;
  onSelect: (canonical: string) => void;
}) {
  const t = useTranslations("identity");
  const tc = useTranslations("common");
  const filteredLinks = props.links.filter((link) => {
    const query = props.query.trim().toLowerCase();
    if (!query) {
      return true;
    }
    if (link.canonical.toLowerCase().includes(query)) {
      return true;
    }
    return link.peers.some(
      (peer) =>
        peer.channel.toLowerCase().includes(query) || peer.peerId.toLowerCase().includes(query),
    );
  });

  return (
    <aside className="identity-nav" aria-label={t("canonicalIdentities")}>
      <div className="identity-nav__head">
        <div className="identity-nav__title">
          <IconSubagents size={14} />
          <span>{t("canonicals")}</span>
          <span className="identity-nav__count">{props.links.length}</span>
        </div>
        <button
          className="identity-panel__button identity-panel__button--icon"
          title={t("unsupportedCreate")}
          type="button"
          onClick={props.onCreateUnsupported}
        >
          <IconPlus size={13} />
          <span>{t("newCanonical")}</span>
        </button>
      </div>

      <label className="identity-nav__search">
        <IconSearch size={13} />
        <input
          aria-label={t("searchCanonicals")}
          placeholder={t("searchPlaceholder")}
          type="search"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
        />
      </label>

      <div className="identity-nav__list" role="tablist" aria-label={t("canonicals")}>
        {props.loading && props.links.length === 0 ? (
          <p className="identity-panel__empty">{tc("loading")}</p>
        ) : null}
        {!props.loading && props.links.length === 0 ? (
          <p className="identity-panel__empty">{t("noLinks")}</p>
        ) : null}
        {props.links.length > 0 && filteredLinks.length === 0 ? (
          <p className="identity-panel__empty">{t("noCanonicalMatches")}</p>
        ) : null}
        {filteredLinks.length > 0
          ? filteredLinks.map((link) => {
              const channels = Array.from(new Set(link.peers.map((peer) => peer.channel)));
              const tone =
                link.peers.length === 0 ? "warn" : link.peers.length >= 3 ? "accent" : "iron";
              return (
                <button
                  key={link.canonical}
                  aria-selected={props.selectedCanonical === link.canonical}
                  className={`identity-nav__item ${
                    props.selectedCanonical === link.canonical ? "identity-nav__item--on" : ""
                  }`}
                  role="tab"
                  type="button"
                  onClick={() => props.onSelect(link.canonical)}
                >
                  <span className="identity-nav__item-head">
                    <strong>{link.canonical}</strong>
                    <span className={`identity-nav__peer-count identity-nav__peer-count--${tone}`}>
                      {t("peerCount", { count: link.peers.length })}
                    </span>
                  </span>
                  {channels.length > 0 ? (
                    <span className="identity-nav__channels">
                      {channels.map((channel) => (
                        <span
                          className={`identity-nav__channel-chip identity-nav__channel-chip--${channel}`}
                          key={`${link.canonical}:${channel}`}
                        >
                          {channel}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="identity-nav__hint identity-nav__hint--warn">
                      {t("guardedSlot")}
                    </span>
                  )}
                </button>
              );
            })
          : null}
      </div>

      <div className="identity-nav__foot">
        <div className="identity-nav__hash">
          <span>{t("hashState")}</span>
          <code>{props.configHash || t("unavailable")}</code>
        </div>
        <button
          className="identity-panel__button identity-panel__button--icon"
          disabled={props.loading}
          type="button"
          onClick={props.onRefresh}
        >
          <IconRefresh size={13} />
          <span>{t("refresh")}</span>
        </button>
      </div>
    </aside>
  );
}
