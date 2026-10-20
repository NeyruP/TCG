import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { instantiate } from "./lib/game/cards";
import { useGame } from "./store/game-store";
import "./styles.css";

// Só no modo de desenvolvimento: acesso ao estado para testes automatizados.
if (import.meta.env.DEV) {
  (window as unknown as { __xb: unknown }).__xb = { useGame, instantiate };
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
