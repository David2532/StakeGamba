/**
 * Central slot-symbol → image mapping.
 *
 * The math engine (math/src/math.ts → SYMBOL_META) emits the symbol IDs below.
 * Every ID that can appear on the reels is mapped to a REAL image file from
 * this folder (frontend/src/Symbols). No text / emoji / CSS fallbacks.
 *
 * Image set provided: 15 PNGs. The engine uses 18 IDs, so a few rare feature
 * symbols (GOLDEN_BALL, CAPTAIN_STAR, COLLECTOR, VAR_SCREEN) reuse the closest
 * matching artwork — clearly noted inline. Math is never changed.
 *
 * Vite turns each `import` into a hashed asset URL (emitted to dist/assets/*).
 */
import s10 from "./10_Symbol.png";
import s9 from "./9_Symbol.png";
import sA from "./A_Symbol.png";
import sJ from "./J_Symbol.png";
import sQ from "./Q_Symbol.png";
import sK from "./K_Symbol.png";
import sBall from "./Ball_Symbol.png";
import sShoe from "./Shoe_symbol.png";
import sDrill from "./Drill_Symbol.png";
import sGoal from "./Goal_Symbol.png";
import sShirt from "./Shirt_symbol.png";
import sTrophy from "./Trophy_Symbol.png";
import sStadium from "./Stadium_Symbol.png";
import sScatter from "./Scatter_Symbol.png";
import sWild from "./Wild_Symbol.png";

/** Math symbol ID → image URL. Keyed exactly on the IDs the engine produces. */
export const SYMBOL_IMAGES: Record<string, string> = {
  // ── Low card ranks ──────────────────────────────────────────────
  "10": s10,
  "9": s9, // engine lowest rank is "10"; kept for completeness
  J: sJ,
  Q: sQ,
  K: sK,
  A: sA,

  // ── Regular themed symbols ──────────────────────────────────────
  FOOTBALL: sBall,
  BOOT: sShoe,
  GLOVE: sDrill, // no glove art → closest sports-gear image
  TICKET: sGoal, // "Stadium Pass" → goal artwork
  ARMBAND: sShirt, // captain armband → jersey/shirt
  TROPHY: sTrophy,
  LIGHTS: sStadium, // stadium floodlights → stadium artwork

  // ── Special / feature symbols ───────────────────────────────────
  WHISTLE: sScatter, // scatter
  WILD_TROPHY: sWild, // wild
  GOLDEN_BALL: sBall, // coin → reuse ball
  CAPTAIN_STAR: sTrophy, // reuse trophy
  COLLECTOR: sTrophy, // reuse trophy
  VAR_SCREEN: sStadium, // reuse stadium
};

const warned = new Set<string>();

/**
 * Resolve a symbol image URL. Returns `undefined` and logs a single clear
 * warning per missing ID — the game never crashes on an unmapped symbol.
 */
export function getSymbolImage(symbolId: string): string | undefined {
  const url = SYMBOL_IMAGES[symbolId];
  if (!url && !warned.has(symbolId)) {
    warned.add(symbolId);
    console.warn("Missing image for symbol: " + symbolId);
  }
  return url;
}
