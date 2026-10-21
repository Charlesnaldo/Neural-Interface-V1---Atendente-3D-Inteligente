/** Convert a 60 Hz blend factor to elapsed seconds, preserving motion at any FPS. */
export function frameBlend(alpha: number, dt: number) {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, alpha)), Math.max(0, dt) * 60)
}

export function morphBlend(current: number, target: number, alpha: number, dt: number) {
  const safe = Number.isFinite(target) ? Math.max(0, Math.min(1, target)) : 0
  return current + (safe - current) * frameBlend(alpha, dt)
}

/** Faster eyelid closure, slower reopening. A complete blink lasts 180 ms. */
export function blinkEnvelope(elapsed: number) {
  if (elapsed < 0 || elapsed >= 0.18) return 0
  if (elapsed < 0.055) return Math.sin(elapsed / 0.055 * Math.PI / 2)
  if (elapsed < 0.075) return 1
  return Math.cos((elapsed - 0.075) / 0.105 * Math.PI / 2)
}
