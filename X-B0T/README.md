# X-B0T — TCG Magia vs Máquina

Versão do jogo X-B0T (a mesma base do link do Drive em `Feira de ciencias/X-B0T`), com:

- **Visual reorganizado**: líder, mão e pilhas no lugar certo, terreno com espaço próprio, cartas que se ajustam ao tamanho da tela e uma linha no meio da mesa que diz o que fazer a seguir.
- **Efeitos de dano**: quando você ou a máquina causa dano aparecem o número flutuando (`-4000`, `-1 ♥`), impacto, tremida da carta, carta se despedaçando ao ser destruída, flash vermelho na tela quando **você** perde vida e flash dourado quando você acerta o líder inimigo.
- **Ataque corrigido**: clique numa carta sua que esteja brilhando e depois no alvo (ou arraste até ele). Funciona direto da fase principal, e quando um ataque não é possível o jogo explica o motivo.
- **Sem cartas de energia**: a energia chega sozinha a cada turno.
- **Efeitos das cartas** conforme o README do repositório (Deck Roxo: Mágico e Deck Amarelo: Especialista).

## Como jogar

Abra **`JOGAR.html`** com dois cliques (ou `INICIAR.bat` no Windows). Não precisa instalar nada; a pasta `cards/` precisa ficar ao lado do arquivo.

## Versão Android (Play Store)

O jogo também é um app Android (pasta `android/`, feito com Capacitor): abre deitado, em tela cheia e funciona offline. O GitHub Actions gera o APK de teste e o `.aab` da Play Store a cada alteração. O passo a passo para publicar, os textos da loja, o ícone, o gráfico de destaque e as capturas de tela estão em [`play-store/`](play-store/PUBLICAR.md).

## Regras rápidas

| Tema | Regra |
| --- | --- |
| Energia | Começa com 2, +1 no seu primeiro turno e +2 nos seguintes. O que sobra fica guardado. |
| Jogar cartas | Clique na carta da mão ou arraste para o seu campo. Máximo de 6 personagens no campo. |
| Atacar | Cartas que podem atacar brilham. Clique nela e depois no alvo. Ninguém ataca na primeira rodada (turnos 1 e 2). |
| Dano | Ataque ≥ defesa atual: a carta é destruída. Senão ela fica ferida (barra de vida) e o dano continua nela. |
| Líder | Perde 1 vida se o ataque for ≥ à defesa do líder (Rogen 5000, Bobo 0). Rogen tem 5 vidas, Bobo 2. |
| Defensor | Enquanto houver um Defensor em campo, ele precisa ser derrotado antes de qualquer outro alvo. |
| Counter | Assembleia e Firewall são usadas quando um aliado seu é atacado (o jogo pergunta). Personagens com Counter +1000/+2000 ganham essa defesa ao serem atacados. |

## Desenvolvimento

O código mantém a estrutura do X-B0T (`src/lib/game` para regras, cartas e máquina; `src/components/game` para a mesa; `src/store` para o estado):

| Arquivo | O que faz |
| --- | --- |
| `src/lib/game/cards.ts` | Definição das cartas e dos baralhos |
| `src/lib/game/engine.ts` | Regras: turnos, custos, ataques, dano, efeitos |
| `src/lib/game/ai.ts` | Jogadas da máquina (fica mais esperta a cada partida) |
| `src/components/game/playmat.tsx` | A mesa de jogo |
| `src/components/game/fx-layer.tsx` | Efeitos visuais de dano, cura e destruição |
| `src/components/game/card-view.tsx` | Desenho de cada carta |

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm run build    # gera JOGAR.html (arquivo único, funciona offline)
npm run android  # build + copia o jogo para o projeto Android (android/)
```

Para abrir o projeto Android no computador, use o Android Studio na pasta `android/` depois de `npm run android`.
