import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { instantiate } from "./lib/game/cards";
import { initMultiplayer } from "./lib/multiplayer/multiplayer";
import { setupNative } from "./lib/native";
import { useGame } from "./store/game-store";
// Fontes embutidas (funciona offline, inclusive no app Android).
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/cormorant-garamond/latin-700.css";
import "@fontsource/figtree/latin-400.css";
import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-600.css";
import "@fontsource/figtree/latin-700.css";
import "./styles.css";

// Só no modo de desenvolvimento: acesso ao estado para testes automatizados.
if (import.meta.env.DEV) {
  (window as unknown as { __xb: unknown }).__xb = { useGame, instantiate };
}

setupNative();
initMultiplayer();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
