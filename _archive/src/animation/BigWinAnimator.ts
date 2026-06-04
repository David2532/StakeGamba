export interface WinTier {
  title: string;
  threshold: number;
  sound: "hit" | "big";
  confettiScale: number;
  duration: number;
}

export const WIN_TIERS: WinTier[] = [
  { title: "World Final Win", threshold: 500, sound: "big", confettiScale: 1.6, duration: 3200 },
  { title: "Champion Win", threshold: 250, sound: "big", confettiScale: 1.35, duration: 2800 },
  { title: "Super Goal", threshold: 100, sound: "big", confettiScale: 1.1, duration: 2300 },
  { title: "Mega Goal", threshold: 50, sound: "big", confettiScale: 0.95, duration: 1900 },
  { title: "Big Goal", threshold: 20, sound: "big", confettiScale: 0.8, duration: 1500 },
  { title: "Nice Goal", threshold: 5, sound: "hit", confettiScale: 0.5, duration: 1050 },
];

export function getWinTier(multiplier: number): WinTier {
  return WIN_TIERS.find((tier) => multiplier >= tier.threshold) ?? WIN_TIERS[WIN_TIERS.length - 1];
}
