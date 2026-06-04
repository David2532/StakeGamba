export function confettiCount(multiplier: number, scale = 1): number {
  return Math.floor(Math.min(120, Math.max(18, (18 + multiplier / 4) * scale)));
}

export function clearElementLater(element: HTMLElement, delayMs: number): void {
  window.setTimeout(() => {
    element.innerHTML = "";
  }, delayMs);
}
