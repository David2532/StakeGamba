export interface TimingPair {
  normal: number;
  turbo: number;
}

export const REEL_TIMING = {
  startFeedback: { normal: 120, turbo: 80 },
  reelDrop: { normal: 1040, turbo: 430 },
  reelStopGap: { normal: 120, turbo: 54 },
  settle: { normal: 260, turbo: 100 },
} satisfies Record<string, TimingPair>;

export function durationFor(timing: TimingPair, turbo: boolean): number {
  return turbo ? timing.turbo : timing.normal;
}

export function reelStopDelay(col: number, turbo: boolean): number {
  return col * durationFor(REEL_TIMING.reelStopGap, turbo);
}
