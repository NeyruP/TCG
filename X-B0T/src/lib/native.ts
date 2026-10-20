import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useGame } from "@/store/game-store";

/**
 * Ajustes do app Android: o botão "voltar" do celular fecha seleções e janelas,
 * volta ao menu e só então sai do jogo.
 */
export function setupNative() {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener("backButton", () => {
    const st = useGame.getState();
    if (st.targeting || st.selectedId) {
      useGame.setState({ targeting: null, selectedId: null });
      return;
    }
    if (st.state?.reveal) {
      st.closeReveal();
      return;
    }
    if (st.screen !== "home") {
      st.go("home");
      return;
    }
    void App.exitApp();
  });
}
