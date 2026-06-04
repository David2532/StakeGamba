export const CASCADE_TIMING = {
  winPulse: { normal: 320, turbo: 140 },
  drop: { normal: 560, turbo: 260 },
  badge: { normal: 720, turbo: 320 },
};

export function cascadeLabel(index: number, multiplier: number): string {
  if (index >= 4) return "PRESSURE BUILDING";
  if (index >= 2) return `GOAL RUSH x${multiplier}`;
  return `CASCADE ${index + 1}`;
}

export function cascadeIntensity(index: number): "low" | "medium" | "high" {
  if (index >= 3) return "high";
  if (index >= 1) return "medium";
  return "low";
}
