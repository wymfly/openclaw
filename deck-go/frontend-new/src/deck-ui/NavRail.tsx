import { useEffect } from "react";
import { useTranslations } from "../i18n/provider";
import { PanelCollapseIcon, PanelExpandIcon, XIcon } from "./icons";
import { getBottomPanels, getPanelGroups, type PanelEntry } from "./panel-registry";
import { useDeckUI } from "./ui-store";
import { useDeckViewport } from "./use-deck-viewport";

function renderBadge(item: PanelEntry) {
  const count = item.badge?.() ?? 0;
  if (count <= 0) {
    return null;
  }
  return <span className="deck-ui-nav-badge">{count > 99 ? "99+" : count}</span>;
}

export function DeckNavRail() {
  const tNav = useTranslations("nav");
  const {
    activePanel,
    mobileNavOpen,
    sidebarCollapsed,
    setActivePanel,
    setSidebarCollapsed,
    setMobileNavOpen,
    toggleSidebar,
  } = useDeckUI();
  const { isMobile, isTablet } = useDeckViewport();
  const groups = getPanelGroups();
  const bottom = getBottomPanels();
  const collapsed = isMobile ? false : sidebarCollapsed;

  useEffect(() => {
    if (isTablet) {
      setSidebarCollapsed(true);
    }
  }, [isTablet, setSidebarCollapsed]);

  useEffect(() => {
    if (!isMobile && mobileNavOpen) {
      setMobileNavOpen(false);
    }
  }, [isMobile, mobileNavOpen, setMobileNavOpen]);

  if (isMobile && !mobileNavOpen) {
    return null;
  }

  const rail = (
    <nav
      className={`deck-ui-rail ${collapsed ? "is-collapsed" : ""}`}
      aria-label={tNav("deckPanels")}
    >
      <div className="deck-ui-rail-brand">
        <button
          className="deck-ui-icon-button"
          type="button"
          onClick={() => (isMobile ? setMobileNavOpen(false) : toggleSidebar())}
          aria-label={
            isMobile
              ? tNav("closeNavigation")
              : collapsed
                ? tNav("expandNavigation")
                : tNav("collapseNavigation")
          }
        >
          {isMobile ? <XIcon /> : collapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
        </button>
      </div>

      <div className="deck-ui-rail-scroll">
        {groups.map((group) => (
          <section key={group.group} className="deck-ui-rail-group">
            {!collapsed ? <p className="deck-ui-rail-title">{tNav(group.titleKey)}</p> : null}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`deck-ui-nav-item ${activePanel === item.id ? "is-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setActivePanel(item.id);
                    if (isMobile) {
                      setMobileNavOpen(false);
                    }
                  }}
                  title={collapsed ? tNav(item.labelKey) : undefined}
                >
                  <span className="deck-ui-nav-glyph">
                    <Icon />
                    {renderBadge(item)}
                  </span>
                  {!collapsed ? <span>{tNav(item.labelKey)}</span> : null}
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <div className="deck-ui-rail-footer">
        {bottom.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`deck-ui-nav-item ${activePanel === item.id ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                setActivePanel(item.id);
                if (isMobile) {
                  setMobileNavOpen(false);
                }
              }}
              title={collapsed ? tNav(item.labelKey) : undefined}
            >
              <span className="deck-ui-nav-glyph">
                <Icon />
                {renderBadge(item)}
              </span>
              {!collapsed ? <span>{tNav(item.labelKey)}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );

  if (isMobile) {
    return (
      <div
        className="deck-ui-rail-overlay"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setMobileNavOpen(false);
          }
        }}
      >
        {rail}
      </div>
    );
  }

  return rail;
}
