import { useEffect } from "react";
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

  if (screen === "play") return <Playmat />;
  if (screen === "tutorial") return <TutorialScreen />;
  if (screen === "setup") return <SetupScreen />;
  if (screen === "rules") return <RulesScreen />;
  if (screen === "result") return <ResultScreen />;
  return <HomeScreen />;
}
