let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (c && c.state === "suspended") void c.resume();
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.04) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  draw: () => beep(420, 0.08, "sine", 0.03),
  play: () => {
    beep(240, 0.12, "triangle", 0.05);
    beep(480, 0.08, "sine", 0.03);
  },
  attack: () => beep(140, 0.16, "sawtooth", 0.045),
  win: () => {
    beep(523, 0.18, "sine", 0.05);
    setTimeout(() => beep(659, 0.2, "sine", 0.05), 90);
    setTimeout(() => beep(784, 0.28, "sine", 0.05), 180);
  },
  lose: () => beep(110, 0.4, "triangle", 0.05),
  hover: () => beep(880, 0.03, "sine", 0.012),
  error: () => beep(90, 0.1, "square", 0.03),
  hit: () => {
    beep(180, 0.12, "square", 0.04);
    beep(90, 0.18, "sawtooth", 0.035);
  },
  hurt: () => {
    beep(70, 0.35, "sawtooth", 0.06);
    setTimeout(() => beep(55, 0.3, "triangle", 0.05), 60);
  },
  strike: () => {
    beep(660, 0.1, "triangle", 0.05);
    setTimeout(() => beep(880, 0.16, "sine", 0.045), 70);
  },
  destroy: () => {
    beep(240, 0.08, "square", 0.04);
    setTimeout(() => beep(120, 0.25, "sawtooth", 0.045), 50);
  },
  heal: () => {
    beep(523, 0.12, "sine", 0.035);
    setTimeout(() => beep(784, 0.16, "sine", 0.03), 80);
  },
  buff: () => beep(600, 0.1, "triangle", 0.03),
  block: () => beep(320, 0.12, "triangle", 0.04),
};
