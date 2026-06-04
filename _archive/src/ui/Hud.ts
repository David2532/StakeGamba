export type StatusTone = "ready" | "spinning" | "bonus" | "error" | "complete";

export function formatSessionTime(startedAt: number, now = Date.now()): string {
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function statusToneForState(state: "idle" | "spinning" | "evaluating" | "win" | "cascading" | "feature" | "bonus" | "complete" | "error"): StatusTone {
  if (state === "error") return "error";
  if (state === "bonus" || state === "feature") return "bonus";
  if (state === "complete") return "complete";
  if (state === "spinning" || state === "evaluating" || state === "win" || state === "cascading") return "spinning";
  return "ready";
}
