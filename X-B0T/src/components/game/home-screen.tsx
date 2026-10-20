import { BookOpen, Play, ScrollText } from "lucide-react";
import { FACTION_META } from "@/lib/game/cards";
import { skillLabel } from "@/lib/game/ai";
import { useGame } from "@/store/game-store";
import { Button } from "@/components/ui/button";

export function HomeScreen() {
  const go = useGame((s) => s.go);
  const progress = useGame((s) => s.progress);
  const skill = useGame((s) => s.skill);

  return (
    <div className="felt relative min-h-dvh overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <HeroCards />
      </div>
      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col justify-between gap-10 px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between gap-4">
          <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
            Magia vs Máquina
          </p>
          <p className="shrink-0 text-[11px] text-muted">
            Máquina: {skillLabel(skill)}
            {progress.matchesPlayed > 0
              ? ` · ${progress.matchesPlayed} partidas`
              : ""}
          </p>
        </header>

        <div className="max-w-xl">
          <p className="text-muted">TCG de duelo</p>
          <h1 className="mt-2 font-display text-5xl leading-[0.92] font-semibold tracking-tight sm:text-7xl">
            X-B0T
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-fg/80">
            Arraste as cartas, jogue contra uma máquina que começa mansa e
            aprende com você. Feito para quem nunca sentou à mesa de um TCG.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
            <Button size="lg" className="w-full rounded-full" onClick={() => go("setup")}>
              <Play className="size-4" />
              Partida rápida
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full rounded-full"
              onClick={() => go("tutorial")}
            >
              <BookOpen className="size-4" />
              Aprender a jogar
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full rounded-full sm:col-span-2"
              onClick={() => go("rules")}
            >
              <ScrollText className="size-4" />
              Regras
            </Button>
          </div>
        </div>

        <footer className="flex flex-wrap gap-8 pt-4 text-sm text-muted">
          <div>
            <p className="text-[11px] tracking-wide uppercase">Escola Arcana</p>
            <p className="mt-1 text-fg">{FACTION_META.magic.leader}</p>
          </div>
          <div>
            <p className="text-[11px] tracking-wide uppercase">Oficina</p>
            <p className="mt-1 text-fg">{FACTION_META.machine.leader}</p>
          </div>
          <div>
            <p className="text-[11px] tracking-wide uppercase">Objetivo</p>
            <p className="mt-1 text-fg">Zerar as vidas do líder inimigo</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function HeroCards() {
  return (
    <div className="absolute top-1/2 right-[-8%] hidden w-[48%] -translate-y-1/2 lg:block">
      <img
        src="cards/bobo.jpg"
        alt=""
        className="absolute top-8 left-24 w-[46%] rotate-6 rounded-[18px] card-shadow-lift"
      />
      <img
        src="cards/rogen.jpg"
        alt=""
        className="relative w-[46%] -rotate-8 rounded-[18px] card-shadow-lift"
      />
    </div>
  );
}

export function SetupScreen() {
  const startMatch = useGame((s) => s.startMatch);
  const go = useGame((s) => s.go);
  const last = useGame((s) => s.progress.lastFaction);

  return (
    <div className="felt min-h-dvh overflow-y-auto px-5 py-8 sm:px-10">
      <button
        onClick={() => go("home")}
        className="text-xs tracking-[0.22em] text-muted uppercase"
      >
        X-B0T
      </button>
      <h1 className="mt-8 font-display text-4xl sm:text-5xl">Escolha sua escola</h1>
      <p className="mt-3 max-w-lg text-muted">
        Você joga com um baralho. A máquina pega o outro. As mãos mudam a cada
        partida — sempre cinco cartas, sempre com pelo menos um atacante. Não
        existem cartas de energia: ela chega sozinha a cada turno.
      </p>
      <div className="mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        <DeckPick
          faction="magic"
          image="cards/rogen.jpg"
          preferred={last === "magic"}
          onPick={() => startMatch("magic")}
        />
        <DeckPick
          faction="machine"
          image="cards/bobo.jpg"
          preferred={last === "machine"}
          onPick={() => startMatch("machine")}
        />
      </div>
    </div>
  );
}

function DeckPick({
  faction,
  image,
  preferred,
  onPick,
}: {
  faction: "magic" | "machine";
  image: string;
  preferred: boolean;
  onPick: () => void;
}) {
  const meta = FACTION_META[faction];
  return (
    <button
      onClick={onPick}
      className="group flex gap-4 rounded-[28px] bg-surface p-4 text-left ring-1 ring-border transition-transform duration-150 hover:ring-border-strong active:scale-[0.98] sm:p-5"
    >
      <img
        src={image}
        alt={meta.leader}
        className="h-36 w-[6.4rem] shrink-0 rounded-[14px] object-cover card-shadow sm:h-48 sm:w-[8.6rem]"
      />
      <div className="flex min-w-0 flex-col justify-between py-1">
        <div>
          <p className="text-[11px] tracking-wide text-muted uppercase">{meta.school}</p>
          <h2 className="mt-1 font-display text-3xl">{meta.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg/80">{meta.blurb}</p>
        </div>
        <p className="mt-3 text-sm text-accent">
          {preferred ? "Última escolha · " : ""}Jogar com {meta.leader}
        </p>
      </div>
    </button>
  );
}

export function RulesScreen() {
  const go = useGame((s) => s.go);
  return (
    <div className="felt min-h-dvh overflow-y-auto px-5 py-8 sm:px-10">
      <button
        onClick={() => go("home")}
        className="text-xs tracking-[0.22em] text-muted uppercase"
      >
        X-B0T
      </button>
      <h1 className="mt-8 max-w-2xl font-display text-4xl sm:text-5xl">
        Para quem nunca jogou um TCG
      </h1>
      <div className="mt-8 grid max-w-3xl gap-4">
        {RULES.map((r) => (
          <section key={r.t} className="rounded-[22px] bg-surface p-5 ring-1 ring-border">
            <h2 className="font-display text-2xl">{r.t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-fg/80">{r.b}</p>
          </section>
        ))}
      </div>
      <div className="mt-8">
        <Button onClick={() => go("tutorial")}>Começar o tutorial</Button>
      </div>
    </div>
  );
}

const RULES = [
  {
    t: "O que é um TCG",
    b: "Trading Card Game: cada um tem um baralho. Vocês jogam cartas na mesa, atacam com personagens e tentam zerar as vidas do líder do outro. Os dois baralhos (Mágico e Especialista) já vêm prontos.",
  },
  {
    t: "A mesa",
    b: "Embaixo ficam o seu líder, a sua mão e as suas pilhas. No meio, os dois campos: o seu (embaixo) e o do inimigo (em cima). O terreno tem um espaço próprio à esquerda de cada campo. A linha do meio sempre diz o que fazer a seguir.",
  },
  {
    t: "Energia e custo",
    b: "Não existem cartas de energia. Você começa com 2, ganha +1 no seu primeiro turno e +2 nos seguintes; o que sobra fica guardado. O número no canto da carta é o custo. Alguns personagens (Helbo, Gatorreta, Lectrabo) recuperam energia, e o líder Bobo joga cartas de custo até 4 de graça.",
  },
  {
    t: "Como jogar uma carta",
    b: "Clique numa carta da mão ou arraste para o seu campo. Itens e alguns efeitos pedem um alvo: depois de escolher a carta, clique no aliado. Personagens entram cansados (ícone da lua) e só atacam no próximo turno, a menos que tenham Apressado.",
  },
  {
    t: "Ataque",
    b: "As cartas que podem atacar ficam brilhando. Clique numa delas (ou no seu líder) e depois no alvo — ou arraste até ele. Atacar o líder tira 1 vida se o ataque for maior ou igual à defesa do líder (Rogen tem 5000, Bobo não tem defesa). Atacar um personagem causa dano: se o ataque for maior ou igual à defesa atual, ele é destruído; senão, fica ferido (a barra de vida mostra quanto sobrou). Na primeira rodada (turnos 1 e 2) ninguém ataca.",
  },
  {
    t: "Defensor e Counter",
    b: "Enquanto houver um Defensor (ícone do escudo) no campo, ele precisa ser derrotado antes de qualquer outro alvo — inclusive o líder. Cartas Counter (Assembleia, Firewall) são usadas quando um aliado seu é atacado: o jogo pergunta se você quer usar. Personagens com Counter +1000/+2000 ganham essa defesa extra ao serem atacados.",
  },
  {
    t: "Vidas",
    b: "Rogen começa com 5 vidas e Bobo com 2. Cada dano no líder vira uma carta de vida para a mão. Quem ficar sem vidas perde. A máquina começa fraca e sobe de nível conforme você joga contra ela.",
  },
];

export function ResultScreen() {
  const result = useGame((s) => s.result);
  const go = useGame((s) => s.go);
  const startMatch = useGame((s) => s.startMatch);
  const faction = useGame((s) => s.progress.lastFaction);
  const skill = useGame((s) => s.skill);
  const won = result === "win";

  return (
    <div className="felt flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] tracking-[0.24em] text-muted uppercase">
        {won ? "Vitória" : "Derrota"}
      </p>
      <h1 className="mt-3 font-display text-5xl sm:text-6xl">
        {won ? "A mesa é sua" : "A máquina levou"}
      </h1>
      <p className="mt-4 max-w-md text-muted">
        {won
          ? "Ela anotou essa partida. Da próxima vez tenta jogar um pouco melhor."
          : "Ela ainda erra bastante. Jogue de novo — o baralho muda a cada mão."}
      </p>
      <p className="mt-2 text-sm text-subtle">Nível da máquina: {skillLabel(skill)}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="rounded-full" onClick={() => startMatch(faction)}>
          Revanche
        </Button>
        <Button size="lg" variant="secondary" className="rounded-full" onClick={() => go("setup")}>
          Trocar de escola
        </Button>
        <Button size="lg" variant="ghost" className="rounded-full" onClick={() => go("home")}>
          Sair
        </Button>
      </div>
    </div>
  );
}
