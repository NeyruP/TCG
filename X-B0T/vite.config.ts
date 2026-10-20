import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build gera um único HTML (JS + CSS embutidos) que abre com dois cliques,
// sem servidor. As imagens ficam em ./cards e são lidas por caminho relativo.
export default defineConfig({
  base: "./",
  publicDir: false,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [tailwindcss(), react(), viteSingleFile()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173 },
});
