import type { CapacitorConfig } from "@capacitor/cli";

// appId é a identidade do app na Play Store e não pode mudar depois da primeira publicação.
const config: CapacitorConfig = {
  appId: "com.neyrup.xb0t",
  appName: "X-B0T",
  webDir: "dist",
  android: {
    backgroundColor: "#0c0d0b",
  },
  plugins: {
    // Tela cheia com barras do sistema escuras e escondidas.
    SystemBars: {
      hidden: true,
      style: "DARK",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
