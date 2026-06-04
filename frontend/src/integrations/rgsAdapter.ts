export interface RgsSessionAdapter {
  validateSession(sessionId: string): Promise<{ valid: boolean; playerId?: string }>;
  getBalance(): Promise<{ balance: number; currency: string; demo: boolean }>;
  placeBet(request: { bet: number; mode?: string }): Promise<{ accepted: boolean; balanceAfterBet: number }>;
  completeBet(request: { bet: number; win: number; seedState?: number }): Promise<{ balanceAfterResult: number }>;
}

// TODO: Replace this interface with a real session-backed implementation when an
// actual RGS/API exists. Keep demo mode local until then.
