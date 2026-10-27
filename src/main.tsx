import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// GitHub Pages is static; the hosted demo supplies the private AI endpoint.
if (window.location.hostname === "manas-jain-24.github.io") {
  window.location.replace(
    "https://brandcheck-codestar-judge.freelynx19.chatgpt.site/",
  );
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
