// Depois do build:
// - copia o HTML gerado para X-B0T/JOGAR.html (ao lado da pasta cards/);
// - copia cards/ para dist/, que é a pasta empacotada no app Android.
import { copyFileSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
copyFileSync(`${root}dist/index.html`, `${root}JOGAR.html`);
cpSync(`${root}cards`, `${root}dist/cards`, { recursive: true });
console.log("JOGAR.html atualizado e cartas copiadas para dist/.");
