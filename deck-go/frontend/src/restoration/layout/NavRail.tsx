import { useEffect } from "react";
import { getRestoredBottomPanels, getRestoredPanelGroups } from "../panel-registry";
import { useRestorationUI } from "../ui-store";
import { useRestorationViewport } from "../use-restoration-viewport";

export function RestoredNavRail() {
  const {
    activePanel,
    mobileNavOpen,
    sidebarCollapsed,
    setActivePanel,
    setSidebarCollapsed,
    setMobileNavOpen,
    toggleSidebar,
  } = useRestorationUI();
  const { isMobile, isTablet } = useRestorationViewport();
  const groups = getRestoredPanelGroups();
  const bottom = getRestoredBottomPanels();

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

  const collapsed = isMobile ? false : sidebarCollapsed;

  const navContent = (
    <nav className={`deckgo-restored-nav ${collapsed ? "is-collapsed" : ""}`}>
      <div className="deckgo-restored-nav-head">
        <div className="deckgo-restored-brand-mark">DG</div>
        {!collapsed ? (
          <div className="deckgo-restored-brand-copy">
            <strong>Deck Go</strong>
            <span>Restored shell</span>
          </div>
        ) : null}
        <button
          className="deckgo-button deckgo-restored-nav-toggle"
          type="button"
          onClick={() => (isMobile ? setMobileNavOpen(false) : toggleSidebar())}
        >
          {isMobile ? "Close" : collapsed ? "Open" : "Mini"}
        </button>
      </div>

      <div className="deckgo-restored-nav-scroll">
        {groups.map((group) => (
          <section key={group.group} className="deckgo-restored-nav-group">
            {!collapsed ? <p className="deckgo-restored-nav-title">{group.title}</p> : null}
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`deckgo-restored-nav-item ${activePanel === item.id ? "is-active" : ""}`}
                type="button"
                onClick={() => setActivePanel(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <span className="deckgo-restored-nav-glyph">{item.monogram}</span>
                {!collapsed ? <span>{item.label}</span> : null}
                {!collapsed && item.shortcutIndex ? (
                  <span className="deckgo-restored-nav-shortcut">Alt+{item.shortcutIndex}</span>
                ) : null}
              </button>
            ))}
          </section>
        ))}
      </div>
      <div className="deckgo-restored-nav-footer">
        {bottom.map((item) => (
          <button
            key={item.id}
            className={`deckgo-restored-nav-item ${activePanel === item.id ? "is-active" : ""}`}
            type="button"
            onClick={() => setActivePanel(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="deckgo-restored-nav-glyph">{item.monogram}</span>
            {!collapsed ? <span>{item.label}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  );

  if (isMobile) {
    return (
      <div
        className="deckgo-restored-nav-overlay"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setMobileNavOpen(false);
          }
        }}
      >
        {navContent}
      </div>
    );
  }

  return navContent;
}
