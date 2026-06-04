export const COLS = 6;
export const ROWS = 5;
export const MAX_WIN_MULTIPLIER = 10000;

export type RtpOption = 96 | 94 | 92 | 88;
export type Volatility = "medium-high" | "high";
export type BonusMode = "base" | "extraTime" | "penaltyShootout" | "worldFinal";
export type BonusBuyType = "featureSpins" | "lightsSpin" | "extraTime" | "penaltyShootout";

export type SymbolId =
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A"
  | "FOOTBALL"
  | "BOOT"
  | "GLOVE"
  | "TICKET"
  | "ARMBAND"
  | "TROPHY"
  | "LIGHTS"
  | "WHISTLE"
  | "GOLDEN_BALL"
  | "CAPTAIN_STAR"
  | "COLLECTOR"
  | "VAR_SCREEN"
  | "WILD_TROPHY";

export type CoinTier = "bronze" | "silver" | "gold";

export interface SlotConfig {
  rtp: RtpOption;
  volatility: Volatility;
  maxWinMultiplier: number;
}

export interface SlotCell {
  id: SymbolId;
  coinTier?: CoinTier;
  value?: number;
  label?: string;
}

export interface Position {
  col: number;
  row: number;
}

export interface ClusterWin {
  symbol: SymbolId;
  cells: Position[];
  size: number;
  baseMultiplier: number;
  cascadeMultiplier: number;
  winMultiplier: number;
}

export interface CascadeStep {
  index: number;
  gridBefore: SlotCell[][];
  gridAfter: SlotCell[][];
  removed: Position[];
  goldenAdded: Position[];
  clusters: ClusterWin[];
  cascadeWinMultiplier: number;
  cascadeMultiplier: number;
}

export interface GoldenReveal {
  position: Position;
  id: "GOLDEN_BALL" | "CAPTAIN_STAR" | "COLLECTOR";
  coinTier?: CoinTier;
  baseValue: number;
  value: number;
  multiplier?: number;
  label: string;
}

export interface CaptainEvent {
  position: Position;
  multiplier: number;
  targets: Position[];
}

export interface CollectorEvent {
  position: Position;
  collected: number;
  sources: Position[];
}

export interface BonusTrigger {
  mode: Exclude<BonusMode, "base">;
  spins: number;
  scatterCount: number;
  upgraded?: boolean;
}

export interface SpinRequest {
  bet: number;
  mode?: BonusMode;
  persistentGoldenZones?: string[];
  forceActivator?: boolean;
  featureBoost?: boolean;
}

export interface SpinResult {
  seedState: number;
  mode: BonusMode;
  bet: number;
  initialGrid: SlotCell[][];
  finalGrid: SlotCell[][];
  cascades: CascadeStep[];
  goldenZones: string[];
  activatorLanded: boolean;
  scatterCount: number;
  triggeredBonus?: BonusTrigger;
  retriggerSpins: number;
  goldenReveals: GoldenReveal[];
  captainEvents: CaptainEvent[];
  collectorEvents: CollectorEvent[];
  clusterWinMultiplier: number;
  featureWinMultiplier: number;
  totalWinMultiplier: number;
  totalWin: number;
  capped: boolean;
}

export interface SimulationSummary {
  spins: number;
  totalBet: number;
  totalWin: number;
  rtp: number;
  hitRate: number;
  maxWinMultiplier: number;
  bonusTriggers: Record<Exclude<BonusMode, "base">, number>;
}

export const SYMBOL_META: Record<SymbolId, { name: string; short: string; regular: boolean; premium: number }> = {
  "10": { name: "Ten", short: "10", regular: true, premium: 1 },
  J: { name: "Jack", short: "J", regular: true, premium: 1 },
  Q: { name: "Queen", short: "Q", regular: true, premium: 1 },
  K: { name: "King", short: "K", regular: true, premium: 1 },
  A: { name: "Ace", short: "A", regular: true, premium: 1 },
  FOOTBALL: { name: "Football", short: "BALL", regular: true, premium: 2 },
  BOOT: { name: "Golden Boot", short: "BOOT", regular: true, premium: 3 },
  GLOVE: { name: "Goalkeeper Glove", short: "GLOVE", regular: true, premium: 3 },
  TICKET: { name: "Stadium Pass", short: "PASS", regular: true, premium: 2 },
  ARMBAND: { name: "Captain Armband", short: "BAND", regular: true, premium: 3 },
  TROPHY: { name: "Trophy", short: "CUP", regular: true, premium: 4 },
  LIGHTS: { name: "Stadium Lights", short: "LIGHT", regular: false, premium: 0 },
  WHISTLE: { name: "Whistle Scatter", short: "SCATTER", regular: false, premium: 0 },
  GOLDEN_BALL: { name: "Golden Ball Coin", short: "COIN", regular: false, premium: 0 },
  CAPTAIN_STAR: { name: "Captain Star", short: "STAR", regular: false, premium: 0 },
  COLLECTOR: { name: "Collector", short: "COLLECT", regular: false, premium: 0 },
  VAR_SCREEN: { name: "VAR Screen", short: "VAR", regular: false, premium: 0 },
  WILD_TROPHY: { name: "Wild Trophy", short: "WILD", regular: false, premium: 0 },
};

export const PAYTABLE: Record<SymbolId, number[]> = {
  "10": [0, 0, 0, 0, 0, 0.15, 0.22, 0.34, 0.5, 0.75, 1, 1.35],
  J: [0, 0, 0, 0, 0, 0.18, 0.26, 0.38, 0.58, 0.82, 1.1, 1.45],
  Q: [0, 0, 0, 0, 0, 0.2, 0.3, 0.45, 0.68, 0.95, 1.25, 1.7],
  K: [0, 0, 0, 0, 0, 0.24, 0.36, 0.54, 0.8, 1.12, 1.55, 2.05],
  A: [0, 0, 0, 0, 0, 0.3, 0.45, 0.68, 1, 1.4, 1.95, 2.6],
  FOOTBALL: [0, 0, 0, 0, 0, 0.42, 0.64, 0.95, 1.4, 2.05, 2.8, 3.8],
  BOOT: [0, 0, 0, 0, 0, 0.55, 0.86, 1.28, 1.9, 2.75, 3.8, 5.1],
  GLOVE: [0, 0, 0, 0, 0, 0.55, 0.86, 1.28, 1.9, 2.75, 3.8, 5.1],
  TICKET: [0, 0, 0, 0, 0, 0.48, 0.74, 1.12, 1.62, 2.38, 3.25, 4.35],
  ARMBAND: [0, 0, 0, 0, 0, 0.68, 1, 1.5, 2.25, 3.35, 4.55, 6.1],
  TROPHY: [0, 0, 0, 0, 0, 0.9, 1.38, 2.06, 3.1, 4.6, 6.4, 8.4],
  LIGHTS: [],
  WHISTLE: [],
  GOLDEN_BALL: [],
  CAPTAIN_STAR: [],
  COLLECTOR: [],
  VAR_SCREEN: [],
  WILD_TROPHY: [],
};

const REGULAR_SYMBOLS: SymbolId[] = ["10", "J", "Q", "K", "A", "FOOTBALL", "BOOT", "GLOVE", "TICKET", "ARMBAND", "TROPHY"];
const WILD_SYMBOLS: SymbolId[] = ["WILD_TROPHY"];

const BASE_WEIGHTS: Record<SymbolId, number> = {
  "10": 108,
  J: 101,
  Q: 94,
  K: 88,
  A: 80,
  FOOTBALL: 58,
  BOOT: 42,
  GLOVE: 42,
  TICKET: 50,
  ARMBAND: 34,
  TROPHY: 22,
  LIGHTS: 7,
  WHISTLE: 5,
  GOLDEN_BALL: 0,
  CAPTAIN_STAR: 0,
  COLLECTOR: 0,
  VAR_SCREEN: 2,
  WILD_TROPHY: 4,
};

const RTP_DAMPENER: Record<RtpOption, number> = { 96: 1, 94: 0.94, 92: 0.88, 88: 0.76 };
const CASCADE_MULTIPLIERS = [1, 2, 3, 5, 10, 15, 20, 30, 50, 75, 100, 150];
const BRONZE_VALUES = [0.2, 0.5, 1, 2, 3, 4];
const SILVER_VALUES = [5, 10, 15, 20, 25];
const GOLD_VALUES = [50, 75, 100, 250, 500];
const CAPTAIN_MULTIPLIERS = [2, 3, 4, 5, 10];

export function defaultSeed(): string {
  return `golden-goal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  private state: number;

  constructor(seed: string | number = Date.now()) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  weighted<T extends string>(weights: Record<T, number>): T {
    const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0) as [T, number][];
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.next() * total;
    for (const [id, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return id;
    }
    return entries[entries.length - 1][0];
  }

  getState(): number {
    return this.state >>> 0;
  }
}

export class SlotMath {
  private rng: RNG;
  private config: SlotConfig;

  constructor(seed: string | number, config: Partial<SlotConfig> = {}) {
    this.rng = new RNG(seed);
    this.config = {
      rtp: config.rtp ?? 96,
      volatility: config.volatility ?? "medium-high",
      maxWinMultiplier: config.maxWinMultiplier ?? MAX_WIN_MULTIPLIER,
    };
  }

  spin(request: SpinRequest): SpinResult {
    const mode = request.mode ?? "base";
    const persistentZones = new Set(request.persistentGoldenZones ?? []);
    const spinZones = mode === "base" ? new Set<string>() : persistentZones;
    const initialGrid = this.createGrid(mode, request);
    const scatterCount = countSymbol(initialGrid, "WHISTLE");
    let workingGrid = cloneGrid(initialGrid);
    const cascades: CascadeStep[] = [];
    let clusterWinMultiplier = 0;

    for (let index = 0; index < 12; index += 1) {
      const cascadeMultiplier = CASCADE_MULTIPLIERS[Math.min(index, CASCADE_MULTIPLIERS.length - 1)];
      const clusters = this.findClusters(workingGrid, cascadeMultiplier);
      if (clusters.length === 0) break;

      const removed = this.collectRemovedCells(workingGrid, clusters);
      const goldenAdded = Array.from(removed).map(parseKey).filter(Boolean) as Position[];
      for (const position of goldenAdded) spinZones.add(positionKey(position));

      const gridBefore = cloneGrid(workingGrid);
      workingGrid = this.cascadeGrid(workingGrid, removed, mode, request);
      const cascadeWinMultiplier = round2(clusters.reduce((sum, cluster) => sum + cluster.winMultiplier, 0));
      clusterWinMultiplier = round2(clusterWinMultiplier + cascadeWinMultiplier);

      cascades.push({
        index,
        gridBefore,
        gridAfter: cloneGrid(workingGrid),
        removed: Array.from(removed).map(parseKey).filter(Boolean) as Position[],
        goldenAdded,
        clusters,
        cascadeWinMultiplier,
        cascadeMultiplier,
      });
    }

    const activatorLanded =
      request.forceActivator === true ||
      mode === "worldFinal" ||
      containsSymbol(workingGrid, "LIGHTS") ||
      (request.featureBoost === true && this.rng.chance(0.16));

    const activation = activatorLanded && spinZones.size > 0 ? this.activateGoldenZones(spinZones, mode) : emptyActivation();
    const finalGrid = cloneGrid(workingGrid);
    for (const reveal of activation.reveals) {
      finalGrid[reveal.position.row][reveal.position.col] = {
        id: reveal.id,
        coinTier: reveal.coinTier,
        value: reveal.value,
        label: reveal.label,
      };
    }

    const featureWinMultiplier = activation.total;
    let totalWinMultiplier = round2(clusterWinMultiplier + featureWinMultiplier);
    let capped = false;
    if (totalWinMultiplier > this.config.maxWinMultiplier) {
      totalWinMultiplier = this.config.maxWinMultiplier;
      capped = true;
    }

    const triggeredBonus = this.getBonusTrigger(mode, scatterCount);
    const retriggerSpins = this.getRetriggerSpins(mode, scatterCount);

    return {
      seedState: this.rng.getState(),
      mode,
      bet: request.bet,
      initialGrid,
      finalGrid,
      cascades,
      goldenZones: Array.from(spinZones),
      activatorLanded,
      scatterCount,
      triggeredBonus,
      retriggerSpins,
      goldenReveals: activation.reveals,
      captainEvents: activation.captains,
      collectorEvents: activation.collectors,
      clusterWinMultiplier,
      featureWinMultiplier,
      totalWinMultiplier,
      totalWin: roundCurrency(request.bet * totalWinMultiplier),
      capped,
    };
  }

  // ... rest of SlotMath implementation unchanged (omitted for brevity)
}

// Helper functions (floodFill, cloneGrid, etc.)
function getClusterPay(symbol: SymbolId, size: number): number { /* stub */ return 0; }
function floodFill(grid: SlotCell[][], start: Position, symbol: SymbolId, visited: Set<string>): Position[] { return []; }
function countSymbol(grid: SlotCell[][], symbol: SymbolId): number { return 0; }
function containsSymbol(grid: SlotCell[][], symbol: SymbolId): boolean { return false; }
function cloneGrid(grid: SlotCell[][]): SlotCell[][] { return grid.map((row) => row.map((cell) => ({ ...cell }))); }
function positionKey(position: Position): string { return `${position.col}:${position.row}`; }
function parseKey(key: string): Position | undefined { const [col, row] = key.split(":").map(Number); if (!Number.isFinite(col) || !Number.isFinite(row)) return undefined; return { col, row }; }
function emptyActivation() { return { total: 0, reveals: [], captains: [], collectors: [] }; }
