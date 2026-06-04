export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function countUp(
  duration: number,
  onFrame: (progress: number) => void,
  onTick?: () => void,
  tickMs = 120,
): Promise<void> {
  const start = performance.now();
  let lastTick = 0;

  return new Promise((resolve) => {
    const frame = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(progress);
      onFrame(eased);

      if (onTick && now - lastTick > tickMs && progress < 1) {
        lastTick = now;
        onTick();
      }

      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    };

    requestAnimationFrame(frame);
  });
}
