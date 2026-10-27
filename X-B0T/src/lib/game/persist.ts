const KEY = "mesa-tcg-v1";
const VERSION = 1;

export interface Progress {
  version: number;
  matchesPlayed: number;
  matchesWon: number;
  tutorialDone: boolean;
  lastFaction: "magic" | "machine";
}

const defaults: Progress = {
  version: VERSION,
  matchesPlayed: 0,
  matchesWon: 0,
  tutorialDone: false,
  lastFaction: "magic",
};

function migrate(raw: Progress): Progress {
  const s = { ...defaults, ...raw };
  s.version = VERSION;
  return s;
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const txt = localStorage.getItem(KEY);
    if (!txt) return { ...defaults };
    return migrate(JSON.parse(txt) as Progress);
  } catch {
    return { ...defaults };
  }
}


export function saveProgress(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}


export function aiSkillFrom(p: Progress): number {
  return Math.min(8, Math.floor(p.matchesPlayed / 2) + p.matchesWon);
}
