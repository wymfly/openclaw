/**
 * Inline script to apply dark/light class before first paint,
 * preventing flash of unstyled content (FOUC).
 */
export function ThemeScript() {
  const script = `
(function() {
  try {
    var stored = localStorage.getItem('openclaw-deck-theme');
    var theme = stored || 'system';
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
