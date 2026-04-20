import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { RestorationPreviewApp } from "./restoration/RestorationPreviewApp";
import "./theme.css";

function shouldRenderLegacyWorkbench() {
  if (typeof window === "undefined") {
    return true;
  }
  return new URLSearchParams(window.location.search).get("surface") === "legacy-workbench";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {shouldRenderLegacyWorkbench() ? <App /> : <RestorationPreviewApp />}
  </React.StrictMode>,
);
