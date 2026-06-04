const STAKE_CURRENCY_SCALE = 1_000_000;

export interface StakeUrlContext {
  sessionID: string;
  rgsUrl: string;
  lang: string;
  device: string;
  social: boolean;
  replay: null | {
    roundId: string;
    costMultiplier: number;
    mode: string;
    betAmount: number;
  };
}

export interface StakeBalance {
  amount: number;
  currency: string;
}

export interface StakeJurisdiction {
  socialCasino?: boolean;
  disabledFullscreen?: boolean;
  disabledTurbo?: boolean;
}

export interface StakeAuthConfig {
  minBet: number;
  maxBet: number;
  stepBet: number;
  defaultBetLevel: number;
  betLevels: number[];
  jurisdiction?: StakeJurisdiction;
}

export interface StakeRound {
  id?: string | number;
  mode?: string;
  event?: unknown;
  events?: unknown[];
  payoutMultiplier?: number;
  costMultiplier?: number;
  state?: Record<string, unknown>;
}

export interface StakeAuthResponse {
  balance: StakeBalance;
  config: StakeAuthConfig;
  round?: StakeRound | null;
}

export interface StakePlayResponse {
  balance: StakeBalance;
  round: StakeRound;
}

export interface StakeEndRoundResponse {
  balance: StakeBalance;
}

export interface StakeSessionClient {
  context: StakeUrlContext;
  authenticate(): Promise<StakeAuthResponse>;
  play(request: { amount: number; mode: string }): Promise<StakePlayResponse>;
  endRound(): Promise<StakeEndRoundResponse>;
  balance(): Promise<StakeBalance>;
}

function parseBoolean(value: string | null): boolean {
  return value === "true" || value === "1";
}

export function readStakeUrlContext(search = window.location.search): StakeUrlContext | null {
  const params = new URLSearchParams(search);
  const sessionID = params.get("sessionID");
  const rgsUrl = params.get("rgs_url");
  if (!sessionID || !rgsUrl) return null;

  const replayRoundId = params.get("roundID") ?? params.get("roundId") ?? params.get("replay_round_id");
  const replayMode = params.get("mode");
  const replayBet = Number(params.get("bet")) || 0;
  const replayCostMultiplier = Number(params.get("costMultiplier")) || 0;

  return {
    sessionID,
    rgsUrl,
    lang: params.get("lang") ?? "en",
    device: params.get("device") ?? "desktop",
    social: parseBoolean(params.get("social")),
    replay: replayRoundId
      ? {
          roundId: replayRoundId,
          costMultiplier: replayCostMultiplier,
          mode: replayMode ?? "base",
          betAmount: replayBet,
        }
      : null,
  };
}

async function postJson<T>(baseUrl: string, path: string, body: Record<string, unknown>): Promise<T> {
  const url = new URL(path, baseUrl).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }
    throw new Error(`${path} failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  return response.json();
}

export function createStakeSessionClient(context = readStakeUrlContext()): StakeSessionClient | null {
  if (!context) return null;

  return {
    context,
    authenticate() {
      return postJson<StakeAuthResponse>(context.rgsUrl, "/wallet/authenticate", {
        sessionID: context.sessionID,
      });
    },
    play(request) {
      return postJson<StakePlayResponse>(context.rgsUrl, "/wallet/play", {
        sessionID: context.sessionID,
        amount: request.amount,
        mode: request.mode,
      });
    },
    endRound() {
      return postJson<StakeEndRoundResponse>(context.rgsUrl, "/wallet/end-round", {
        sessionID: context.sessionID,
      });
    },
    async balance() {
      const response = await postJson<{ balance: StakeBalance }>(context.rgsUrl, "/wallet/balance", {
        sessionID: context.sessionID,
      });
      return response.balance;
    },
  };
}

export function stakeUnitsToCredits(amount: number): number {
  return amount / STAKE_CURRENCY_SCALE;
}

export function creditsToStakeUnits(amount: number): number {
  return Math.round(amount * STAKE_CURRENCY_SCALE);
}
