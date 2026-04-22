import React from "react";
import ReactDOM from "react-dom/client";
import { RestorationPreviewApp } from "./restoration/RestorationPreviewApp";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RestorationPreviewApp />
  </React.StrictMode>,
);
