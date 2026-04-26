import React from "react";
import ReactDOM from "react-dom/client";
import { DeckGoApp } from "./deck-ui/App";
import { DeckRoot } from "./i18n/provider";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DeckRoot>
      <DeckGoApp />
    </DeckRoot>
  </React.StrictMode>,
);
