import { useEffect, useState } from "react";

type Theme = "dark" | "light";
type Density = "comfortable" | "compact";

/**
 * frontend-new placeholder App.
 *
 * Renders a minimal scaffolded-state notice with theme + density toggles so
 * design tokens are visibly exercised. Real modules land here per the
 * deck-go-chat-protocol-pilot change (chat first) and successive panel
 * migration changes thereafter.
 */
export function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [density, setDensity] = useState<Density>("comfortable");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
  }, [theme, density]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--ds-bg-0)",
        color: "var(--ds-text-1)",
        fontFamily: "var(--ds-font-sans)",
        fontSize: "var(--ds-fs-body)",
        lineHeight: "var(--ds-line)",
        display: "grid",
        placeItems: "center",
        padding: "var(--ds-sp-7)",
      }}
    >
      <main
        style={{
          maxWidth: 560,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "var(--ds-sp-5)",
          padding: "var(--ds-sp-7)",
          background: "var(--ds-bg-1)",
          border: "1px solid var(--ds-border)",
          borderRadius: "var(--ds-radius-lg)",
          boxShadow: "var(--ds-shadow-md)",
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
          <span style={{ fontSize: "var(--ds-fs-meta)", color: "var(--ds-text-3)" }}>
            deck-go · protocol-v1
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            frontend-new scaffolded
          </h1>
          <p style={{ margin: 0, color: "var(--ds-text-2)" }}>
            modules pending. design system canonical (tokens · 36 atoms · hooks · gallery) migrated.
            add{" "}
            <code
              style={{
                fontFamily: "var(--ds-font-mono)",
                fontSize: "var(--ds-fs-code)",
                background: "var(--ds-code-bg)",
                border: "1px solid var(--ds-code-border)",
                borderRadius: "var(--ds-radius-sm)",
                padding: "1px 4px",
              }}
            >
              ?dsGallery=1
            </code>{" "}
            to inspect every atom.
          </p>
        </header>

        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--ds-sp-3)",
          }}
        >
          <Toggle
            label="Theme"
            value={theme}
            options={["dark", "light"]}
            onChange={(v) => setTheme(v)}
          />
          <Toggle
            label="Density"
            value={density}
            options={["comfortable", "compact"]}
            onChange={(v) => setDensity(v)}
          />
        </section>

        <footer style={{ fontSize: "var(--ds-fs-meta)", color: "var(--ds-text-3)" }}>
          See <code style={{ fontFamily: "var(--ds-font-mono)" }}>frontend-new/CLAUDE.md</code> for
          protocol entry ·{" "}
          <code style={{ fontFamily: "var(--ds-font-mono)" }}>../docs/CLAUDE.md</code> for project
          navigation.
        </footer>
      </main>
    </div>
  );
}

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-4)" }}>
      <span style={{ minWidth: 84, color: "var(--ds-text-2)" }}>{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        style={{
          display: "inline-flex",
          background: "var(--ds-bg-2)",
          border: "1px solid var(--ds-border-subtle)",
          borderRadius: "var(--ds-radius-md)",
          padding: 2,
          gap: 2,
        }}
      >
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt)}
              style={{
                appearance: "none",
                cursor: active ? "default" : "pointer",
                border: "none",
                background: active ? "var(--ds-bg-elev)" : "transparent",
                color: active ? "var(--ds-text-1)" : "var(--ds-text-2)",
                fontFamily: "inherit",
                fontSize: "var(--ds-fs-meta)",
                padding: "4px 10px",
                borderRadius: "calc(var(--ds-radius-md) - 2px)",
                fontWeight: active ? 600 : 500,
                transition: "background 120ms ease, color 120ms ease",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
