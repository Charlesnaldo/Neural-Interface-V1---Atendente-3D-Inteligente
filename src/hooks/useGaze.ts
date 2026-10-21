'use client'
import { useEffect, useState, type RefObject } from 'react'
import { estimateGaze, type Gaze } from '@/lib/gaze'

export function useGaze(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [gaze, setGaze] = useState<Gaze | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    if (!enabled) return
    let worker: Worker | null = null
    let disposed = false, ready = false, busy = false, failed = false
    let lastVideoTime = -1
    let lastFrameAt = 0
    let smoothed: Gaze | null = null
    let timeout: ReturnType<typeof setTimeout> | undefined
    function fail() { if (disposed) return; failed = true; setStatus('error'); setGaze(null); worker?.terminate(); clearTimeout(timeout) }
    const interval = setInterval(async () => {
      const video = videoRef.current
      if (smoothed && (document.hidden || performance.now() - lastFrameAt > 700)) { smoothed = null; setGaze(null) }
      if (disposed || failed || document.hidden || !video || video.readyState < 2 || !video.videoWidth) return
      // Wait for the existing camera stream: never request a second permission or microphone.
      if (!worker) {
        setStatus('loading'); setGaze(null)
        try {
          worker = new Worker('/gaze-worker.js')
          worker.onerror = fail
          worker.onmessage = (event: MessageEvent<{ type: string; landmarks?: { x: number; y: number }[] | null }>) => {
            if (disposed) return
            if (event.data.type === 'error') { fail(); return }
            if (event.data.type === 'ready') { ready = true; clearTimeout(timeout); setStatus('ready'); return }
            busy = false
            clearTimeout(timeout)
            const next = event.data.landmarks ? estimateGaze(event.data.landmarks) : null
            smoothed = next ? { x: (smoothed?.x ?? next.x) * 0.55 + next.x * 0.45, y: (smoothed?.y ?? next.y) * 0.55 + next.y * 0.45 } : null
            setGaze(smoothed)
          }
          worker.postMessage({ type: 'init', origin: window.location.origin })
          timeout = setTimeout(fail, 45000)
        } catch { fail() }
      }
      if (!ready || busy || video.currentTime === lastVideoTime) return
      busy = true; lastVideoTime = video.currentTime; lastFrameAt = performance.now()
      try {
        const bitmap = await createImageBitmap(video, { resizeWidth: 480, resizeHeight: Math.round(480 * video.videoHeight / video.videoWidth) })
        if (disposed || failed) { bitmap.close(); return }
        worker?.postMessage({ type: 'frame', bitmap, timestamp: performance.now() }, [bitmap])
        timeout = setTimeout(fail, 5000)
      } catch { fail() }
    }, 100)
    return () => { disposed = true; clearInterval(interval); clearTimeout(timeout); worker?.terminate(); setGaze(null); setStatus('loading') }
  }, [enabled, videoRef])
  return { gaze: enabled ? gaze : null, status: enabled ? status : 'off' }
}
