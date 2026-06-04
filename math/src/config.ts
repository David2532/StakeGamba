import { MAX_WIN_MULTIPLIER, type BonusBuyType, type BonusMode, type RtpOption, type SlotConfig, type Volatility } from "./math";

export const RTP_OPTIONS: RtpOption[] = [96, 94, 92, 88];
export const VOLATILITY_OPTIONS: Volatility[] = ["medium-high", "high"];
export const DEMO_BET_OPTIONS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100] as const;

export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  rtp: 96,
  volatility: "medium-high",
  maxWinMultiplier: MAX_WIN_MULTIPLIER,
};

export const BONUS_BUY_OPTIONS: ReadonlyArray<{
  type: BonusBuyType;
  label: string;
  costMultiplier: number;
  startsMode?: Exclude<BonusMode, "base">;
}> = [
  { type: "featureSpins", label: "Feature Spins", costMultiplier: 3 },
  { type: "lightsSpin", label: "Stadium Lights Spin", costMultiplier: 50 },
  { type: "extraTime", label: "Extra Time Bonus", costMultiplier: 100, startsMode: "extraTime" },
  { type: "penaltyShootout", label: "Penalty Shootout", costMultiplier: 250, startsMode: "penaltyShootout" },
];

export const GAME_CONFIG = {
  id: "golden_goal_rush",
  name: "Golden Goal Rush",
  grid: { cols: 6, rows: 5 },
  demoBetOptions: DEMO_BET_OPTIONS,
  defaultConfig: DEFAULT_SLOT_CONFIG,
  maxWinMultiplier: MAX_WIN_MULTIPLIER,
  bonusBuyOptions: BONUS_BUY_OPTIONS,
} as const;
