import type { TrackedFace } from '@/hooks/useVision'

// Decorative mesh anchored to the detected box; these are not measured landmarks.
const points = [[50,5],[25,15],[75,15],[12,35],[35,32],[65,32],[88,35],[20,52],[42,48],[58,48],[80,52],[50,65],[28,72],[72,72],[38,87],[62,87],[50,97]]
const edges = [[0,1],[0,2],[0,4],[0,5],[1,2],[1,3],[1,4],[2,5],[2,6],[3,4],[3,7],[4,5],[4,7],[4,8],[5,6],[5,9],[5,10],[6,10],[7,8],[7,12],[8,9],[8,11],[8,12],[9,10],[9,11],[9,13],[10,13],[11,12],[11,13],[11,14],[11,15],[12,14],[13,15],[14,15],[14,16],[15,16]]

export function FaceScanOverlay({ faces }: { faces: TrackedFace[] }) {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    {faces.map(face => <div key={face.id} className="scan-face absolute" style={{ left: `${face.x * 100}%`, top: `${face.y * 100}%`, width: `${face.width * 100}%`, height: `${face.height * 100}%` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <g stroke="#7dd3fc" strokeWidth="0.35" fill="none" opacity="0.65">{edges.map(([a,b], i) => <line key={i} x1={points[a][0]} y1={points[a][1]} x2={points[b][0]} y2={points[b][1]} />)}</g>
        <g fill="#cffafe">{points.map(([x,y], i) => <circle key={i} cx={x} cy={y} r="0.65" />)}</g>
        <path d="M0 18V0H18 M82 0H100V18 M100 82V100H82 M18 100H0V82" fill="none" stroke="#38bdf8" strokeWidth="2" />
      </svg>
      <div className="scan-beam absolute left-0 right-0 h-5 border-b border-cyan-100 bg-gradient-to-t from-cyan-300/50 to-transparent" />
      <span className="absolute -top-5 left-0 whitespace-nowrap bg-slate-950/85 px-1 font-mono text-[9px] tracking-widest text-cyan-200">ROSTO {face.id} · RASTREANDO</span>
    </div>)}
    {faces.length > 0 && <div className="absolute bottom-1 right-1 rounded border border-cyan-400/30 bg-slate-950/85 px-2 py-1 font-mono text-[8px] tracking-widest text-cyan-200">VISÃO ATIVA · {faces.length} ROSTO(S)<div className="mt-1 h-0.5 w-full overflow-hidden bg-cyan-950"><div className="scan-signal h-full w-1/3 bg-cyan-300" /></div></div>}
    <style jsx>{`
      .scan-face { transition: left 160ms linear, top 160ms linear, width 160ms linear, height 160ms linear; filter: drop-shadow(0 0 3px #0891b2); }
      .scan-beam { animation: face-scan 2.4s ease-in-out infinite alternate; }
      .scan-signal { animation: signal-scan 1.8s linear infinite alternate; }
      @keyframes face-scan { from { top: 0%; } to { top: calc(100% - 20px); } }
      @keyframes signal-scan { to { transform: translateX(200%); } }
      @media (prefers-reduced-motion: reduce) { .scan-beam { animation: none; top: 50%; } .scan-signal { animation: none; } .scan-face { transition: none; } }
    `}</style>
  </div>
}
