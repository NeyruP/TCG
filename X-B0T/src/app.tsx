import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import {
  HomeScreen,
  ResultScreen,
  RulesScreen,
  SetupScreen,
} from "@/components/game/home-screen";
import { Playmat } from "@/components/game/playmat";
import { TutorialScreen } from "@/components/game/tutorial";
import { useGame } from "@/store/game-store";

export function App() {
  const screen = useGame((s) => s.screen);
  const hydrate = useGame((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <Screen screen={screen} />
      <div className="rotate-hint fixed inset-0 z-[100] flex-col items-center justify-center gap-4 bg-bg px-8 text-center">
        <RotateCcw className="size-10 text-amber-200" />
        <p className="font-display text-3xl">Gire o celular</p>
        <p className="text-sm text-muted">O X-B0T é jogado com a tela deitada.</p>
      </div>
    </>
  );
}

function Screen({ screen }: { screen: string }) {
  if (screen === "play") return <Playmat />;
  if (screen === "tutorial") return <TutorialScreen />;
  if (screen === "setup") return <SetupScreen />;
  if (screen === "rules") return <RulesScreen />;
  if (screen === "result") return <ResultScreen />;
  return <HomeScreen />;
}
