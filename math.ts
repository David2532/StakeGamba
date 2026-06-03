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
  TICKET: { name: "Stadium Ticket", short: "TICKET", regular: true, premium: 2 },
  ARMBAND: { name: "Captain Armband", short: "BAND", regular: true, premium: 3 },
  TROPHY: { name: "Trophy", short: "CUP", regular: true, premium: 4 },
  LIGHTS: { name: "Stadium Lights", short: "LIGHT", regular: false, premium: 0 },
  WHISTLE: { name: "Whistle Scatter", short: "WHISTLE", regular: false, premium: 0 },
  GOLDEN_BALL: { name: "Golden Ball Coin", short: "COIN", regular: false, premium: 0 },
  CAPTAIN_STAR: { name: "Captain Star", short: "STAR", regular: false, premium: 0 },
  COLLECTOR: { name: "Trophy Collector", short: "COLLECT", regular: false, premium: 0 },
  VAR_SCREEN: { name: "VAR Screen", short: "VAR", regular: false, premium: 0 },
  WILD_TROPHY: { name: "Wild Trophy", short: "WILD", regular: false, premium: 0 },
};

export const PAYTABLE: Record<SymbolId, number[]> = {
  "10": [0, 0, 0, 0, 0, 0.15, 0.2, 0.3, 0.45, 0.65, 0.9, 1.2],
  J: [0, 0, 0, 0, 0, 0.15, 0.22, 0.32, 0.48, 0.7, 0.95, 1.25],
  Q: [0, 0, 0, 0, 0, 0.18, 0.26, 0.38, 0.55, 0.8, 1.1, 1.45],
  K: [0, 0, 0, 0, 0, 0.2, 0.3, 0.45, 0.65, 0.95, 1.3, 1.7],
  A: [0, 0, 0, 0, 0, 0.25, 0.38, 0.55, 0.8, 1.15, 1.6, 2.1],
  FOOTBALL: [0, 0, 0, 0, 0, 0.35, 0.55, 0.8, 1.15, 1.7, 2.35, 3.1],
  BOOT: [0, 0, 0, 0, 0, 0.45, 0.7, 1.05, 1.55, 2.25, 3.2, 4.2],
  GLOVE: [0, 0, 0, 0, 0, 0.45, 0.7, 1.05, 1.55, 2.25, 3.2, 4.2],
  TICKET: [0, 0, 0, 0, 0, 0.4, 0.62, 0.95, 1.35, 2, 2.75, 3.6],
  ARMBAND: [0, 0, 0, 0, 0, 0.55, 0.85, 1.25, 1.9, 2.8, 3.9, 5.1],
  TROPHY: [0, 0, 0, 0, 0, 0.75, 1.15, 1.7, 2.55, 3.8, 5.3, 7],
  LIGHTS: [],
  WHISTLE: [],
  GOLDEN_BALL: [],
  CAPTAIN_STAR: [],
  COLLECTOR: [],
  VAR_SCREEN: [],
  WILD_TROPHY: [],
};

const REGULAR_SYMBOLS: SymbolId[] = [
  "10",
  "J",
  "Q",
  "K",
  "A",
  "FOOTBALL",
  "BOOT",
  "GLOVE",
  "TICKET",
  "ARMBAND",
  "TROPHY",
];

const BASE_WEIGHTS: Record<SymbolId, number> = {
  "10": 105,
  J: 100,
  Q: 94,
  K: 88,
  A: 82,
  FOOTBALL: 58,
  BOOT: 42,
  GLOVE: 42,
  TICKET: 50,
  ARMBAND: 34,
  TROPHY: 24,
  LIGHTS: 7,
  WHISTLE: 5,
  GOLDEN_BALL: 0,
  CAPTAIN_STAR: 0,
  COLLECTOR: 0,
  VAR_SCREEN: 2,
  WILD_TROPHY: 3,
};

const RTP_DAMPENER: Record<RtpOption, number> = {
  96: 1,
  94: 0.94,
  92: 0.88,
  88: 0.76,
};

const CASCADE_MULTIPLIERS = [1, 2, 3, 5, 10, 15, 20, 30, 50];
const BRONZE_VALUES = [0.2, 0.5, 1, 2, 3, 4];
const SILVER_VALUES = [5, 10, 15, 20];
const GOLD_VALUES = [25, 50, 100, 250, 500];
const CAPTAIN_MULTIPLIERS = [2, 3, 4, 5, 10];

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
      for (const position of goldenAdded) {
        spinZones.add(positionKey(position));
      }

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
    let finalGrid = cloneGrid(workingGrid);
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

  bonusBuy(type: BonusBuyType, bet: number): { cost: number; request?: Partial<SpinRequest>; startsBonus?: BonusTrigger } {
    if (type === "featureSpins") {
      return { cost: roundCurrency(bet * 3), request: { featureBoost: true } };
    }

    if (type === "lightsSpin") {
      return { cost: roundCurrency(bet * 50), request: { forceActivator: true } };
    }

    if (type === "extraTime") {
      return { cost: roundCurrency(bet * 100), startsBonus: { mode: "extraTime", spins: 8, scatterCount: 3 } };
    }

    return { cost: roundCurrency(bet * 250), startsBonus: { mode: "penaltyShootout", spins: 12, scatterCount: 4 } };
  }

  getConfig(): SlotConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<SlotConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private createGrid(mode: BonusMode, request: SpinRequest): SlotCell[][] {
    return Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ id: this.randomSymbol(mode, request) })),
    );
  }

  private randomSymbol(mode: BonusMode, request: SpinRequest): SymbolId {
    const weights = { ...BASE_WEIGHTS };
    const dampener = RTP_DAMPENER[this.config.rtp];

    weights.LIGHTS = Math.max(1, Math.round(weights.LIGHTS * dampener));
    weights.WHISTLE = Math.max(1, Math.round(weights.WHISTLE * dampener));
    weights.WILD_TROPHY = Math.max(1, Math.round(weights.WILD_TROPHY * dampener));

    if (request.featureBoost) {
      weights.WHISTLE *= 5;
      weights.LIGHTS *= 2;
    }

    if (mode === "extraTime") {
      weights.WHISTLE += 2;
      weights.LIGHTS += 4;
      weights.WILD_TROPHY += 2;
    }

    if (mode === "penaltyShootout") {
      weights.WHISTLE += 3;
      weights.LIGHTS += 7;
      weights.WILD_TROPHY += 4;
    }

    if (mode === "worldFinal") {
      weights.LIGHTS = 0;
      weights.WHISTLE += 2;
      weights.WILD_TROPHY += 6;
    }

    return this.rng.weighted(weights);
  }

  private findClusters(grid: SlotCell[][], cascadeMultiplier: number): ClusterWin[] {
    const wins: ClusterWin[] = [];
    const claimed = new Set<string>();

    for (const symbol of REGULAR_SYMBOLS) {
      const visited = new Set<string>();

      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const key = positionKey({ col, row });
          if (visited.has(key)) continue;
          if (grid[row][col].id !== symbol) continue;

          const cells = floodFill(grid, { col, row }, symbol, visited);
          const naturalCells = cells.filter((position) => grid[position.row][position.col].id === symbol);
          if (cells.length >= 5 && naturalCells.length > 0) {
            const uniqueKey = cells
              .map(positionKey)
              .sort()
              .join("|");
            if (claimed.has(`${symbol}:${uniqueKey}`)) continue;
            claimed.add(`${symbol}:${uniqueKey}`);

            const baseMultiplier = getClusterPay(symbol, cells.length);
            wins.push({
              symbol,
              cells,
              size: cells.length,
              baseMultiplier,
              cascadeMultiplier,
              winMultiplier: round2(baseMultiplier * cascadeMultiplier),
            });
          }
        }
      }
    }

    return wins;
  }

  private collectRemovedCells(grid: SlotCell[][], clusters: ClusterWin[]): Set<string> {
    const removed = new Set<string>();
    const winningSymbols = new Set<SymbolId>();

    for (const cluster of clusters) {
      winningSymbols.add(cluster.symbol);
      for (const cell of cluster.cells) {
        removed.add(positionKey(cell));
      }
    }

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cell = grid[row][col];
        if (winningSymbols.has(cell.id)) removed.add(positionKey({ col, row }));
      }
    }

    return removed;
  }

  private cascadeGrid(grid: SlotCell[][], removed: Set<string>, mode: BonusMode, request: SpinRequest): SlotCell[][] {
    const next = emptyGrid();

    for (let col = 0; col < COLS; col += 1) {
      const survivors: SlotCell[] = [];
      for (let row = ROWS - 1; row >= 0; row -= 1) {
        if (!removed.has(positionKey({ col, row }))) {
          survivors.push({ ...grid[row][col] });
        }
      }

      for (let row = ROWS - 1; row >= 0; row -= 1) {
        const survivor = survivors.shift();
        next[row][col] = survivor ?? { id: this.randomSymbol(mode, request) };
      }
    }

    return next;
  }

  private activateGoldenZones(goldenZones: Set<string>, mode: BonusMode) {
    const reveals: GoldenReveal[] = Array.from(goldenZones)
      .map(parseKey)
      .filter(Boolean)
      .map((position) => this.createGoldenReveal(position as Position, mode));

    const captains: CaptainEvent[] = [];
    for (const captain of reveals.filter((reveal) => reveal.id === "CAPTAIN_STAR")) {
      const multiplier = this.rng.pick(CAPTAIN_MULTIPLIERS);
      captain.multiplier = multiplier;
      captain.value = multiplier;
      captain.label = `${multiplier}x`;
      const targets = adjacentPositions(captain.position).filter((position) =>
        reveals.some((reveal) => samePosition(reveal.position, position) && reveal.id !== "CAPTAIN_STAR"),
      );

      for (const target of targets) {
        const targetReveal = reveals.find((reveal) => samePosition(reveal.position, target));
        if (!targetReveal) continue;
        targetReveal.value = round2(targetReveal.value * multiplier);
        targetReveal.label = `${targetReveal.value}x`;
      }

      captains.push({ position: captain.position, multiplier, targets });
    }

    const coinReveals = reveals.filter((reveal) => reveal.id === "GOLDEN_BALL");
    const collectors: CollectorEvent[] = [];
    const orderedCollectors = reveals
      .filter((reveal) => reveal.id === "COLLECTOR")
      .sort((a, b) => a.position.row - b.position.row || a.position.col - b.position.col);

    for (const collector of orderedCollectors) {
      const earlierCollectorSources = orderedCollectors.filter((other) => {
        if (samePosition(other.position, collector.position)) return false;
        return other.position.row < collector.position.row || (other.position.row === collector.position.row && other.position.col < collector.position.col);
      });
      const sources = [...coinReveals, ...earlierCollectorSources];
      const collected = round2(sources.reduce((sum, reveal) => sum + reveal.value, 0));
      collector.value = collected;
      collector.label = `${collected}x`;
      collectors.push({ position: collector.position, collected, sources: sources.map((source) => source.position) });
    }

    const coinTotal = coinReveals.reduce((sum, reveal) => sum + reveal.value, 0);
    const collectorTotal = orderedCollectors.reduce((sum, reveal) => sum + reveal.value, 0);
    return {
      reveals,
      captains,
      collectors,
      total: round2(coinTotal + collectorTotal),
    };
  }

  private createGoldenReveal(position: Position, mode: BonusMode): GoldenReveal {
    const profile = this.getRevealProfile(mode);
    const pick = this.rng.weighted(profile);

    if (pick === "CAPTAIN_STAR") {
      return { position, id: "CAPTAIN_STAR", baseValue: 1, value: 1, label: "STAR" };
    }

    if (pick === "COLLECTOR") {
      return { position, id: "COLLECTOR", baseValue: 0, value: 0, label: "COLLECT" };
    }

    const tier = pick as CoinTier;
    const value = this.pickCoinValue(tier, mode);
    return {
      position,
      id: "GOLDEN_BALL",
      coinTier: tier,
      baseValue: value,
      value,
      label: `${value}x`,
    };
  }

  private getRevealProfile(mode: BonusMode): Record<CoinTier | "CAPTAIN_STAR" | "COLLECTOR", number> {
    if (mode === "worldFinal") {
      return { bronze: 0, silver: 66, gold: 24, CAPTAIN_STAR: 3, COLLECTOR: 7 };
    }

    if (mode === "penaltyShootout") {
      return { bronze: 54, silver: 25, gold: 7, CAPTAIN_STAR: 7, COLLECTOR: 7 };
    }

    if (mode === "extraTime") {
      return { bronze: 64, silver: 22, gold: 4, CAPTAIN_STAR: 5, COLLECTOR: 5 };
    }

    return { bronze: 72, silver: 18, gold: 3, CAPTAIN_STAR: 4, COLLECTOR: 3 };
  }

  private pickCoinValue(tier: CoinTier, mode: BonusMode): number {
    if (tier === "gold") return weightedValue(this.rng, GOLD_VALUES, [44, 27, 16, 9, mode === "worldFinal" ? 4 : 1]);
    if (tier === "silver") return weightedValue(this.rng, SILVER_VALUES, [45, 30, 18, 7]);
    return weightedValue(this.rng, BRONZE_VALUES, [20, 24, 24, 17, 10, 5]);
  }

  private getBonusTrigger(mode: BonusMode, scatterCount: number): BonusTrigger | undefined {
    if (mode !== "base") {
      if (mode !== "worldFinal" && scatterCount >= 4) {
        return { mode: "worldFinal", spins: 12, scatterCount, upgraded: true };
      }
      return undefined;
    }

    if (scatterCount >= 5) return { mode: "worldFinal", spins: 12, scatterCount };
    if (scatterCount >= 4) return { mode: "penaltyShootout", spins: 12, scatterCount };
    if (scatterCount >= 3) return { mode: "extraTime", spins: 8, scatterCount };
    return undefined;
  }

  private getRetriggerSpins(mode: BonusMode, scatterCount: number): number {
    if (mode === "base") return 0;
    if (scatterCount >= 3) return 4;
    if (scatterCount >= 2) return 2;
    return 0;
  }
}

export function defaultSeed(): string {
  return `golden-goal-${new Date().toISOString().slice(0, 10)}`;
}

export function simulateRtp(
  spins: number,
  seed: string | number = "golden-goal-simulation",
  config: Partial<SlotConfig> = {},
  bet = 1,
): SimulationSummary {
  const engine = new SlotMath(seed, config);
  const summary: SimulationSummary = {
    spins,
    totalBet: 0,
    totalWin: 0,
    rtp: 0,
    hitRate: 0,
    maxWinMultiplier: 0,
    bonusTriggers: {
      extraTime: 0,
      penaltyShootout: 0,
      worldFinal: 0,
    },
  };
  let hits = 0;

  for (let index = 0; index < spins; index += 1) {
    const result = engine.spin({ bet, mode: "base" });
    summary.totalBet = roundCurrency(summary.totalBet + bet);
    summary.totalWin = roundCurrency(summary.totalWin + result.totalWin);
    summary.maxWinMultiplier = Math.max(summary.maxWinMultiplier, result.totalWinMultiplier);
    if (result.totalWin > 0) hits += 1;
    if (result.triggeredBonus) summary.bonusTriggers[result.triggeredBonus.mode] += 1;
  }

  summary.rtp = summary.totalBet > 0 ? roundCurrency((summary.totalWin / summary.totalBet) * 100) : 0;
  summary.hitRate = spins > 0 ? roundCurrency((hits / spins) * 100) : 0;
  return summary;
}

export function positionKey(position: Position): string {
  return `${position.col},${position.row}`;
}

export function parseKey(key: string): Position | undefined {
  const [col, row] = key.split(",").map(Number);
  if (!Number.isInteger(col) || !Number.isInteger(row)) return undefined;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return undefined;
  return { col, row };
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cloneGrid(grid: SlotCell[][]): SlotCell[][] {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function emptyGrid(): SlotCell[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ id: "10" as SymbolId })));
}

function countSymbol(grid: SlotCell[][], id: SymbolId): number {
  return grid.flat().filter((cell) => cell.id === id).length;
}

function containsSymbol(grid: SlotCell[][], id: SymbolId): boolean {
  return grid.some((row) => row.some((cell) => cell.id === id));
}

function cellMatches(cell: SlotCell, symbol: SymbolId): boolean {
  return cell.id === symbol || cell.id === "WILD_TROPHY";
}

function floodFill(grid: SlotCell[][], start: Position, symbol: SymbolId, visited: Set<string>): Position[] {
  const stack = [start];
  const cells: Position[] = [];

  while (stack.length > 0) {
    const current = stack.pop() as Position;
    const key = positionKey(current);
    if (visited.has(key)) continue;
    visited.add(key);
    if (!cellMatches(grid[current.row][current.col], symbol)) continue;

    cells.push(current);
    for (const next of cardinalPositions(current)) {
      if (!visited.has(positionKey(next)) && cellMatches(grid[next.row][next.col], symbol)) {
        stack.push(next);
      }
    }
  }

  return cells;
}

function cardinalPositions(position: Position): Position[] {
  return [
    { col: position.col + 1, row: position.row },
    { col: position.col - 1, row: position.row },
    { col: position.col, row: position.row + 1 },
    { col: position.col, row: position.row - 1 },
  ].filter(inBounds);
}

function adjacentPositions(position: Position): Position[] {
  const positions: Position[] = [];
  for (let row = position.row - 1; row <= position.row + 1; row += 1) {
    for (let col = position.col - 1; col <= position.col + 1; col += 1) {
      if (col === position.col && row === position.row) continue;
      const next = { col, row };
      if (inBounds(next)) positions.push(next);
    }
  }
  return positions;
}

function inBounds(position: Position): boolean {
  return position.col >= 0 && position.col < COLS && position.row >= 0 && position.row < ROWS;
}

function samePosition(a: Position, b: Position): boolean {
  return a.col === b.col && a.row === b.row;
}

function getClusterPay(symbol: SymbolId, size: number): number {
  const table = PAYTABLE[symbol] ?? [];
  if (table.length === 0) return 0;
  const cappedSize = Math.min(size, table.length - 1);
  const base = table[cappedSize] ?? table[table.length - 1];
  const extra = size > table.length - 1 ? (size - table.length + 1) * base * 0.08 : 0;
  return round2(base + extra);
}

function weightedValue(rng: RNG, values: number[], weights: number[]): number {
  const map: Record<string, number> = {};
  values.forEach((value, index) => {
    map[String(value)] = weights[index] ?? 1;
  });
  return Number(rng.weighted(map));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function emptyActivation() {
  return {
    reveals: [] as GoldenReveal[],
    captains: [] as CaptainEvent[],
    collectors: [] as CollectorEvent[],
    total: 0,
  };
}
