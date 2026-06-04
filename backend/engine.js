// Engine wrapper for Stake: exports a `spin(request)` function that the platform can call.
// It uses the compiled `math.js` (SlotMath) to produce spin results.
import { SlotMath, defaultSeed } from './math.js';

/**
 * spin(request)
 * - request.bet: number
 * - request.mode: optional bonus mode
 * - request.clientSeed: optional string
 * - request.serverSeed: optional string (if not provided, uses defaultSeed())
 * - request.persistentGoldenZones: optional
 */
export async function spin(request) {
  const serverSeed = request.serverSeed || process.env.SERVER_SEED || defaultSeed();
  const clientSeed = request.clientSeed || `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const combinedSeed = `${serverSeed}:${clientSeed}`;

  const math = new SlotMath(combinedSeed, { rtp: request.rtp ?? 96 });
  const res = math.spin({
    bet: request.bet ?? 1,
    mode: request.mode,
    persistentGoldenZones: request.persistentGoldenZones,
    featureBoost: request.featureBoost,
    forceActivator: request.forceActivator,
  });

  // Attach seeds so caller can verify (server must reveal serverSeed later for provably-fair)
  return { ...res, clientSeed, serverSeedUsed: serverSeed };
}

export function info() {
  return { name: 'Golden Goal Rush', version: '0.1.0', rtp: 96 };
}
