export const DESIGN_TOKENS = {
  colors: {
    background: "#020806",
    background2: "#06150f",
    background3: "#0b1f16",
    primaryGold: "#f5c84b",
    deepGold: "#a87511",
    neonGreen: "#21f58b",
    premiumWhite: "#f4f1df",
    dangerRed: "#ff3d5a",
    glassBorder: "rgba(255,255,255,0.08)",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    pill: "999px",
  },
  shadows: {
    panel: "0 22px 80px rgba(0,0,0,0.54)",
    goldGlow: "0 0 38px rgba(245,200,75,0.32)",
    greenGlow: "0 0 34px rgba(33,245,139,0.22)",
  },
  z: {
    background: "0",
    game: "2",
    hud: "8",
    overlay: "20",
  },
  motion: {
    instant: "90ms",
    fast: "160ms",
    medium: "320ms",
    feature: "680ms",
    ambient: "14s",
    easeOut: "cubic-bezier(.16, 1, .3, 1)",
    backOut: "cubic-bezier(.2, 1.35, .32, 1)",
  },
  type: {
    label: "12px",
    value: "20px",
    button: "22px",
    hero: "34px",
  },
} as const;

export function applyDesignTokens(root: HTMLElement): void {
  root.style.setProperty("--bg", DESIGN_TOKENS.colors.background);
  root.style.setProperty("--panel-radius", DESIGN_TOKENS.radius.md);
  root.style.setProperty("--motion-fast", DESIGN_TOKENS.motion.fast);
  root.style.setProperty("--motion-medium", DESIGN_TOKENS.motion.medium);
  root.style.setProperty("--ease-out", DESIGN_TOKENS.motion.easeOut);
  root.style.setProperty("--ease-back-out", DESIGN_TOKENS.motion.backOut);
}
