import { useEffect } from "react";
import { useGame } from "@/store/game-store";
import { Button } from "@/components/ui/button";
import { Playmat } from "./playmat";

const STEPS: { title: string; body: string; wait?: string }[] = [
  {
    title: "O que é isso?",
    body: "Um TCG é um jogo de cartas em que cada um tem um baralho. Você joga personagens na mesa, gasta energia e tenta zerar as vidas do líder do outro. Sem pressa — vamos no seu ritmo.",
  },
  {
    title: "A mesa",
    body: "Você está embaixo, a máquina em cima. Seu líder (Rogen) fica à esquerda da sua mão: os corações são as vidas e o ⚡ é a energia, que chega sozinha a cada turno. A linha do meio sempre diz o que fazer.",
  },
  {
    title: "Invocar",
    body: "O número no canto da carta é o custo em energia. Clique no Marbo (ou arraste para o seu campo). Ele tem Apressado: pode atacar no mesmo turno.",
    wait: "summon",
  },
  {
    title: "Atacar",
    body: "Cartas que podem atacar ficam brilhando. Clique no seu líder Rogen e depois no líder inimigo. Para tirar 1 vida, o ataque precisa ser igual ou maior que a defesa do líder inimigo (5000) — o Marbo (4000) ainda não consegue. Repare no efeito de dano!",
    wait: "attack",
  },
  {
    title: "Passar o turno",
    body: "Quando terminar, clique em Passar turno. Observe a máquina: quando ela te acertar, a tela pisca em vermelho e o número do dano aparece em cima da carta.",
  },
  {
    title: "Pronto",
    body: "Isso é o suficiente para uma partida de verdade. Dica: Defensores (escudo) protegem o líder, e cartas Counter salvam seus aliados quando são atacados.",
  },
];

export function TutorialScreen() {
  const state = useGame((s) => s.state);
  const startMatch = useGame((s) => s.startMatch);
  const step = useGame((s) => s.tutorialStep);
  const setTutorialStep = useGame((s) => s.setTutorialStep);
  const finishTutorial = useGame((s) => s.finishTutorial);
  const go = useGame((s) => s.go);
  const lastAction = state?.lastAction ?? null;

  useEffect(() => {
    startMatch("magic", true);
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const wait = STEPS[step]?.wait;
    if (!wait || !lastAction) return;
    if (wait === lastAction) {
      setTutorialStep(Math.min(step + 1, STEPS.length - 1));
    }
  }, [lastAction, step, setTutorialStep]);

  if (!state) {
    return <div className="felt min-h-dvh" />;
  }

  const current = STEPS[step] ?? STEPS[0]!;
  const last = step >= STEPS.length - 1;

  return (
    <div className="relative">
      <Playmat tutorial />
      <div className="pointer-events-none absolute inset-x-0 top-12 z-20 flex justify-center px-3">
        <div className="pointer-events-auto w-full max-w-lg rounded-[22px] bg-surface/95 p-4 shadow-2xl ring-1 ring-amber-200/30 sm:p-5">
          <p className="text-[11px] tracking-wide text-muted uppercase">
            Tutorial {step + 1}/{STEPS.length}
          </p>
          <h2 className="mt-1 font-display text-2xl">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg/85">{current.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!last && (
              <Button size="sm" variant="secondary" onClick={() => setTutorialStep(step + 1)}>
                Pular este passo
              </Button>
            )}
            {last ? (
              <Button size="sm" onClick={finishTutorial}>
                Ir para a partida rápida
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => go("home")}>
                Sair
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
