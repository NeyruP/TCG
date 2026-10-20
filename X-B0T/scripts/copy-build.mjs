// Copia o HTML gerado pelo build para X-B0T/JOGAR.html (ao lado da pasta cards/).
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
copyFileSync(`${root}dist/index.html`, `${root}JOGAR.html`);
console.log("JOGAR.html atualizado.");
