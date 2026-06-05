// Config bridge for WORLD GOAL RUSH.
//
// The Stake math pipeline emits config_fe.json next to the published frontend.
// This loader fetches it when present and otherwise falls back to a built-in
// default so the MVP always renders, even with no math package available.
//
// IMPORTANT: this is a *display/setup* bridge only. It never drives payouts,
// RTP or wallet logic. Math/publish files stay the source of truth.

export type GameConfigSymbol = {
  id: string;
  name: string;
  type: string;
};

export type GameConfig = {
  gameId: string;
  workingName: string;
  title: string;
  subtitle: string;
  ways: number;
  volatility: number; // 1..5, drives the lightning meter
  board: { reels: number; rows: number };
  betSteps: number[];
  defaultBet: number;
  coinValueDivisor: number; // bet / divisor = displayed coin value
  jackpot: number; // mock "Road to Glory" prestige value
  symbols: GameConfigSymbol[];
};

// Bet steps per spec Appendix B.
export const DEFAULT_BET_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

export const DEFAULT_GAME_CONFIG: GameConfig = {
  gameId: "world_goal_rush",
  workingName: "World Goal Rush",
  title: "WORLD GOAL RUSH",
  subtitle: "CHAMPIONSHIP EDITION",
  ways: 4096,
  volatility: 4,
  board: { reels: 6, rows: 5 },
  betSteps: DEFAULT_BET_STEPS,
  defaultBet: 20,
  coinValueDivisor: 100,
  jackpot: 2500,
  symbols: [],
};

function coerceConfig(raw: unknown): GameConfig {
  const data = (raw ?? {}) as Record<string, unknown>;
  const board = (data.board ?? {}) as Record<string, unknown>;
  const betSteps = Array.isArray(data.betSteps)
    ? (data.betSteps as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : DEFAULT_GAME_CONFIG.betSteps;

  return {
    gameId: typeof data.gameId === "string" ? data.gameId : DEFAULT_GAME_CONFIG.gameId,
    workingName:
      typeof data.workingName === "string" ? data.workingName : DEFAULT_GAME_CONFIG.workingName,
    title: typeof data.title === "string" ? data.title : DEFAULT_GAME_CONFIG.title,
    subtitle: typeof data.subtitle === "string" ? data.subtitle : DEFAULT_GAME_CONFIG.subtitle,
    ways: Number.isFinite(Number(data.ways)) ? Number(data.ways) : DEFAULT_GAME_CONFIG.ways,
    volatility: Number.isFinite(Number(data.volatility))
      ? Math.max(1, Math.min(5, Number(data.volatility)))
      : DEFAULT_GAME_CONFIG.volatility,
    board: {
      reels: Number.isFinite(Number(board.reels)) ? Number(board.reels) : DEFAULT_GAME_CONFIG.board.reels,
      rows: Number.isFinite(Number(board.rows)) ? Number(board.rows) : DEFAULT_GAME_CONFIG.board.rows,
    },
    betSteps: betSteps.length > 0 ? betSteps : DEFAULT_GAME_CONFIG.betSteps,
    defaultBet: Number.isFinite(Number(data.defaultBet))
      ? Number(data.defaultBet)
      : DEFAULT_GAME_CONFIG.defaultBet,
    coinValueDivisor: Number.isFinite(Number(data.coinValueDivisor))
      ? Number(data.coinValueDivisor)
      : DEFAULT_GAME_CONFIG.coinValueDivisor,
    jackpot: Number.isFinite(Number(data.jackpot)) ? Number(data.jackpot) : DEFAULT_GAME_CONFIG.jackpot,
    symbols: Array.isArray(data.symbols)
      ? (data.symbols as GameConfigSymbol[])
      : DEFAULT_GAME_CONFIG.symbols,
  };
}

/**
 * Load the optional Stake frontend config. Never throws: any failure (missing
 * file, bad JSON, offline) resolves to DEFAULT_GAME_CONFIG.
 */
export async function loadGameConfig(url = "/config_fe.json"): Promise<GameConfig> {
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`No config at ${url}`);
    const raw = await response.json();
    return coerceConfig(raw);
  } catch {
    return DEFAULT_GAME_CONFIG;
  }
}
