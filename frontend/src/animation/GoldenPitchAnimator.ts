export const GOLDEN_PITCH_TIMING = {
  create: { normal: 300, turbo: 130 },
  lightSweep: { normal: 760, turbo: 360 },
  reveal: { normal: 640, turbo: 280 },
};

export function goldenParticleCount(zoneCount: number): number {
  return Math.min(90, Math.max(18, zoneCount * 6));
}

export function collectorBeamAlpha(sourceCount: number): number {
  return Math.min(0.92, 0.35 + sourceCount * 0.08);
}
