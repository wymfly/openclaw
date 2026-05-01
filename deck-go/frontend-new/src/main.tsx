import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./design-system/tokens/index.css";
import "./theme.css";
import { ChatPanel } from "./components/panels/chat/ChatPanel";
import { DeckRoot } from "./i18n/provider";

const dsGallery =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("dsGallery") === "1";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (dsGallery) {
  // Lazy import keeps the gallery + its atom graph out of production bundles.
  void import("./design-system/dev/Gallery").then(({ DesignSystemGallery }) => {
    root.render(
      <React.StrictMode>
        <DesignSystemGallery />
      </React.StrictMode>,
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <DeckRoot>
        <ChatPanel />
      </DeckRoot>
    </React.StrictMode>,
  );
}
