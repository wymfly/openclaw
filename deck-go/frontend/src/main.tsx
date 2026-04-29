import React from "react";
import ReactDOM from "react-dom/client";
import { DeckGoApp } from "./deck-ui/App";
import { DeckRoot } from "./i18n/provider";
import "./theme.css";

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
        <DeckRoot>
          <DesignSystemGallery />
        </DeckRoot>
      </React.StrictMode>,
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <DeckRoot>
        <DeckGoApp />
      </DeckRoot>
    </React.StrictMode>,
  );
}
