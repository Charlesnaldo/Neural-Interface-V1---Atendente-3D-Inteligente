export type Gaze = { x: number; y: number }
type Point = { x: number; y: number }
const clamp = (value: number) => Math.max(-1, Math.min(1, value))

/** Iris displacement in each eye's own axes, not a calibrated screen coordinate. */
export function estimateGaze(points: Point[]): Gaze | null {
  if (points.length < 478) return null
  function eye(a: number, b: number, upper: number, lower: number, iris: number) {
    const p = points[a], q = points[b], top = points[upper], bottom = points[lower], pupil = points[iris]
    if (![p, q, top, bottom, pupil].every(v => v && Number.isFinite(v.x) && Number.isFinite(v.y))) return null
    const dx = q.x - p.x, dy = q.y - p.y
    const width = Math.hypot(dx, dy)
    if (width < 0.008 || Math.hypot(top.x - bottom.x, top.y - bottom.y) / width < 0.12) return null
    const ux = dx / width, uy = dy / width
    const x = pupil.x - (p.x + q.x) / 2, y = pupil.y - (top.y + bottom.y) / 2
    return { x: (x * ux + (pupil.y - (p.y + q.y) / 2) * uy) / width, y: (-x * uy + y * ux) / width }
  }
  const left = eye(33, 133, 159, 145, 468)
  const right = eye(362, 263, 386, 374, 473)
  if (!left || !right || Math.abs(left.x - right.x) > 0.25) return null
  return { x: clamp((left.x + right.x) * 3), y: clamp(-(left.y + right.y) * 3) }
}

export function gazeLabel(gaze: Gaze | null) {
  if (!gaze) return 'Posicione somente seu rosto diante da câmera'
  if (Math.abs(gaze.x) < 0.18 && Math.abs(gaze.y) < 0.18) return 'Olhar próximo ao centro'
  return Math.abs(gaze.x) > Math.abs(gaze.y) ? (gaze.x > 0 ? 'Olhar à direita da imagem' : 'Olhar à esquerda da imagem') : (gaze.y > 0 ? 'Olhar para cima' : 'Olhar para baixo')
}
