// Depois do build:
// - gera X-B0T/JOGAR.html: o HTML do build com os ícones e as imagens das cartas
//   embutidos (window.__XB_CARDS), para funcionar sozinho, sem a pasta cards/ do lado;
// - copia cards/ para dist/, que é a pasta empacotada no app Android
//   (lá as imagens ficam como arquivos e o HTML fica leve).
import { cpSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
// Ícones (apple-touch-icon etc.) que o Vite deixou como arquivos ao lado do HTML.
const html = readFileSync(`${root}dist/index.html`, "utf8").replace(
  /href="\.\/([\w.-]+\.png)"/g,
  (_, file) => `href="data:image/png;base64,${readFileSync(`${root}dist/${file}`).toString("base64")}"`,
);

const cards = {};
for (const file of readdirSync(`${root}cards`).sort()) {
  if (!file.endsWith(".jpg")) continue;
  const data = readFileSync(`${root}cards/${file}`).toString("base64");
  cards[file.slice(0, -4)] = `data:image/jpeg;base64,${data}`;
}
const at = html.indexOf("</head>");
if (at < 0) throw new Error("dist/index.html sem </head>");
const embed = `<script>window.__XB_CARDS=${JSON.stringify(cards)};</script>\n`;
writeFileSync(`${root}JOGAR.html`, html.slice(0, at) + embed + html.slice(at));

cpSync(`${root}cards`, `${root}dist/cards`, { recursive: true });
console.log(`JOGAR.html atualizado (${Object.keys(cards).length} cartas embutidas) e cartas copiadas para dist/.`);
