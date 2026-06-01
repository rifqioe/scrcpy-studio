import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { ControlOverlay } from "./components/ControlOverlay";
import "./index.css";

// The standalone control window reuses index.html; pick what to render by window label.
const isControl = getCurrentWindow().label === "control";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isControl ? <ControlOverlay /> : <App />}</React.StrictMode>,
);
