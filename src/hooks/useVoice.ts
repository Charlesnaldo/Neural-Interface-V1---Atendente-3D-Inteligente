'use client'

import * as THREE from 'three'
import { useCallback, useEffect, useRef, useState } from 'react'
import { frameBlend } from '@/lib/face-motion'

type DominantBand = 'low' | 'mid' | 'high'

interface AudioMetrics {
  amplitude: number
  sharpness: number
  low: number
  mid: number
  high: number
  dominantBand: DominantBand
  mouthOpen: number
  mouthWide: number
  mouthRound: number
  mouthClosed: number
  mouthPress: number
  mouthDental: number
}

interface SpeechCursor {
  text: string
  startedAt: number
  estimatedDuration: number
  boundaryIndex: number
  boundaryAt: number
  phaseOffset: number
}

const ZERO_METRICS: AudioMetrics = {
  amplitude: 0, sharpness: 0, low: 0, mid: 0, high: 0, dominantBand: 'mid',
  mouthOpen: 0, mouthWide: 0, mouthRound: 0, mouthClosed: 0, mouthPress: 0, mouthDental: 0,
}

const normalizeSpeechText = (text: string) => text.replace(/\s+/g, ' ').trim()

const simplifyChar = (char: string) =>
  char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// attack/release com velocidades separadas
const smoothValue = (current: number, next: number, attack = 0.34, release = 0.16) => {
  const factor = next > current ? attack : release
  return current * (1 - factor) + next * factor
}

const createSpeechCursor = (text: string): SpeechCursor => {
  const cleanText = normalizeSpeechText(text)
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length
  const pauseCount = cleanText.match(/[,.!?;:]/g)?.length ?? 0
  return {
    text: cleanText,
    startedAt: performance.now(),
    estimatedDuration: Math.max(900, wordCount * 390 + cleanText.length * 18 + pauseCount * 130),
    boundaryIndex: 0,
    boundaryAt: performance.now(),
    phaseOffset: Math.random() * Math.PI,
  }
}

const getBandsForChar = (char: string) => {
  if (char === 'a') return { low: 0.38, mid: 0.76, high: 0.24 }
  if (char === 'e') return { low: 0.24, mid: 0.64, high: 0.44 }
  if (char === 'i') return { low: 0.12, mid: 0.46, high: 0.78 }
  if (char === 'o') return { low: 0.66, mid: 0.46, high: 0.18 }
  if (char === 'u') return { low: 0.72, mid: 0.32, high: 0.14 }
  if ('fvszjx'.includes(char)) return { low: 0.1, mid: 0.36, high: 0.82 }
  if ('mnpbtdkgcqrl'.includes(char)) return { low: 0.44, mid: 0.54, high: 0.28 }
  return { low: 0.22, mid: 0.45, high: 0.26 }
}

const getMouthShapeForChar = (rawChar: string) => {
  const char = simplifyChar(rawChar)

  // A small relaxed lip seal between words; jaw movement can settle during pauses.
  if (/[\s,.!?;:]/.test(rawChar)) {
    return { open: 0.08, wide: 0, round: 0, closed: 0.18, press: 0.04, dental: 0 }
  }

  // Vogais — abertura generosa para garantir movimento visível
  if (char === 'a') return { open: 0.82, wide: 0.08, round: 0,    closed: 0,    press: 0,    dental: 0    }
  if (char === 'e') return { open: 0.52, wide: 0.68, round: 0,    closed: 0,    press: 0,    dental: 0.05 }
  if (char === 'i') return { open: 0.30, wide: 0.86, round: 0,    closed: 0,    press: 0,    dental: 0.08 }
  if (char === 'o') return { open: 0.44, wide: 0.04, round: 0.72, closed: 0,    press: 0,    dental: 0    }
  if (char === 'u') return { open: 0.28, wide: 0,    round: 0.88, closed: 0,    press: 0,    dental: 0    }

  // Consoantes bilabiais: boca fechada brevemente, depois reabre
  if ('mpb'.includes(char)) return { open: 0.04, wide: 0.02, round: 0, closed: 0.72, press: 0.85, dental: 0    }
  // Labiodentais: lábio superior sobe
  if ('fv'.includes(char))  return { open: 0.22, wide: 0.26, round: 0, closed: 0.06, press: 0.06, dental: 0.86 }
  // Sibilantes
  if ('szxj'.includes(char)) return { open: 0.18, wide: 0.56, round: 0.02, closed: 0.06, press: 0.10, dental: 0.32 }
  // Alveolares/dentais
  if ('tdnl'.includes(char)) return { open: 0.24, wide: 0.28, round: 0,    closed: 0.14, press: 0.18, dental: 0.38 }
  // Velares
  if ('kgcq'.includes(char)) return { open: 0.30, wide: 0.18, round: 0.08, closed: 0.08, press: 0.12, dental: 0.08 }
  // Líquidas/semivogais
  if ('rhyw'.includes(char)) return { open: 0.26, wide: 0.24, round: char === 'w' ? 0.52 : 0.08, closed: 0.04, press: 0.04, dental: 0.04 }

  return { open: 0.24, wide: 0.24, round: 0.04, closed: 0.04, press: 0.04, dental: 0.04 }
}

const getDominantBand = (low: number, mid: number, high: number): DominantBand => {
  if (high >= mid && high >= low) return 'high'
  if (mid >= low) return 'mid'
  return 'low'
}

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

export const useVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics>(ZERO_METRICS)
  const isUnlockedRef = useRef(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const meterFrameRef = useRef<number | null>(null)
  const keepAliveRef = useRef<number | null>(null)
  const speechCursorRef = useRef<SpeechCursor | null>(null)
  const audioMetricsRef = useRef<AudioMetrics>(ZERO_METRICS)

  // Expõe a ref diretamente para que o FaceModel possa lê-la
  // sem depender do ciclo de re-render do useState.
  const audioMetricsLiveRef = audioMetricsRef

  const loadVoices = useCallback(() => {
    voicesRef.current = window.speechSynthesis.getVoices()
  }, [])

  useEffect(() => {
    loadVoices()
    const synth = window.speechSynthesis
    const prev = synth.onvoiceschanged
    const handler = (e: Event) => { prev?.call(synth, e); loadVoices() }
    synth.onvoiceschanged = handler
    return () => { if (synth.onvoiceschanged === handler) synth.onvoiceschanged = prev }
  }, [loadVoices])

  const selectComputerVoice = useCallback(() => {
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices()
    const isPtBr = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-').startsWith('pt-br')
    const isPt   = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith('pt')
    return (
      voices.find(v => v.localService && isPtBr(v)) ||
      voices.find(v => v.localService && isPt(v))   ||
      voices.find(isPtBr) || voices.find(isPt)      ||
      voices.find(v => v.localService) || voices[0] || null
    )
  }, [])

  const stopLocalMeter = useCallback(() => {
    if (meterFrameRef.current) { cancelAnimationFrame(meterFrameRef.current); meterFrameRef.current = null }
    speechCursorRef.current = null
    audioMetricsRef.current = ZERO_METRICS
    setAudioMetrics(ZERO_METRICS)
  }, [])

  const startLocalMeter = useCallback((text: string) => {
    stopLocalMeter()
    const cursor = createSpeechCursor(text)
    speechCursorRef.current = cursor
    let previousTick = performance.now()

    const tick = () => {
      const activeCursor = speechCursorRef.current
      if (!activeCursor) return

      const now      = performance.now()
      const dt = Math.min(0.05, Math.max(0, (now - previousTick) / 1000))
      previousTick = now
      const smooth = (current: number, next: number, attack: number, release: number) =>
        smoothValue(current, next, frameBlend(attack, dt), frameBlend(release, dt))
      const elapsed  = now - activeCursor.startedAt
      const progress = THREE.MathUtils.clamp(elapsed / activeCursor.estimatedDuration, 0, 1)

      // Índice do caractere atual — usa boundary quando disponível
      const fallbackIndex  = Math.floor(progress * Math.max(1, activeCursor.text.length - 1))
      const boundaryIndex  = activeCursor.boundaryIndex + Math.floor((now - activeCursor.boundaryAt) / 58)
      const charIndex      = THREE.MathUtils.clamp(
        Math.max(fallbackIndex, boundaryIndex), 0,
        Math.max(0, activeCursor.text.length - 1)
      )

      const rawChar  = activeCursor.text[charIndex] || 'a'
      const char     = simplifyChar(rawChar)
      const isPause  = /[\s,.!?;:]/.test(rawChar)

      // ── Fade in/out suave nos extremos da fala ─────────────────────────
      const fade = THREE.MathUtils.clamp(Math.min(progress / 0.05, (1 - progress) / 0.06), 0, 1)

      // ── Pulso de sílaba ────────────────────────────────────────────────
      // Keep syllable energy positive; punctuation is gated separately below.
      const phase        = elapsed / 1000 * (6.5 + activeCursor.text.length * 0.015) + activeCursor.phaseOffset
      const rawPulse     = Math.sin(phase * Math.PI)           // -1 a 1
      const syllablePulse = 0.35 + (rawPulse * 0.5 + 0.5) * 0.65

      // Pulso de frase (variação lenta de energia)
      const phrasePulse  = 0.6 + Math.sin(phase * 0.38) * 0.4  // 0.2 a 1.0

      // ── Amplitude geral ────────────────────────────────────────────────
      // Punctuation has no voice energy, allowing the face to settle naturally.
      const amplitudeTarget = THREE.MathUtils.clamp(
        (isPause
          ? 0
          : 0.22 + syllablePulse * 0.55 + phrasePulse * 0.08
        ) * fade,
        0, 1
      )

      // ── Articulação ────────────────────────────────────────────────────
      const articulation = THREE.MathUtils.clamp(
        (isPause ? 0 : 0.45 + amplitudeTarget * 0.75) * fade,
        0, 1
      )

      const mouthShape = getMouthShapeForChar(rawChar)
      const bands      = getBandsForChar(char)

      // ── Targets de boca ────────────────────────────────────────────────
      //
      // Respect the selected lip shape: bilabials can close without a forced jaw floor.
      const openTarget   = THREE.MathUtils.clamp(
        mouthShape.open * articulation,
        0, 0.85
      )
      const wideTarget   = THREE.MathUtils.clamp(mouthShape.wide   * articulation, 0, 0.88)
      const roundTarget  = THREE.MathUtils.clamp(mouthShape.round  * articulation, 0, 0.88)
      const closedTarget = THREE.MathUtils.clamp(mouthShape.closed * fade,         0, 0.80)
      const pressTarget  = THREE.MathUtils.clamp(mouthShape.press  * fade,         0, 0.85)
      const dentalTarget = THREE.MathUtils.clamp(mouthShape.dental * articulation, 0, 0.88)

      // ── Bandas espectrais ──────────────────────────────────────────────
      const low  = THREE.MathUtils.clamp(bands.low  * amplitudeTarget + 0.02, 0, 1)
      const mid  = THREE.MathUtils.clamp(bands.mid  * amplitudeTarget + 0.03, 0, 1)
      const high = THREE.MathUtils.clamp(bands.high * amplitudeTarget + 0.015, 0, 1)
      const spectrumTotal = Math.max(0.001, low + mid + high)
      const sharpness = THREE.MathUtils.clamp((high * 1.18 + mid * 0.28) / spectrumTotal, 0, 1)

      // ── Smooth ────────────────────────────────────────────────────────
      // mouthOpen: attack RÁPIDO (0.68) para seguir sílabas,
      //            release moderado (0.24) para não ficar aberta demais.
      const prev = audioMetricsRef.current
      audioMetricsRef.current = {
        amplitude:   smooth(prev.amplitude,   amplitudeTarget, 0.45, 0.20),
        sharpness:   smooth(prev.sharpness,   sharpness,       0.34, 0.12),
        low:         smooth(prev.low,         low,             0.34, 0.12),
        mid:         smooth(prev.mid,         mid,             0.34, 0.12),
        high:        smooth(prev.high,        high,            0.36, 0.12),
        dominantBand: getDominantBand(low, mid, high),
        mouthOpen:   smooth(prev.mouthOpen,   openTarget,   0.68, 0.24),
        mouthWide:   smooth(prev.mouthWide,   wideTarget,   0.52, 0.18),
        mouthRound:  smooth(prev.mouthRound,  roundTarget,  0.52, 0.20),
        mouthClosed: smooth(prev.mouthClosed, closedTarget, 0.62, 0.30),
        mouthPress:  smooth(prev.mouthPress,  pressTarget,  0.62, 0.28),
        mouthDental: smooth(prev.mouthDental, dentalTarget, 0.48, 0.20),
      }

      setAudioMetrics(audioMetricsRef.current)
      meterFrameRef.current = requestAnimationFrame(tick)
    }

    tick()
  }, [stopLocalMeter])

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) { window.clearInterval(keepAliveRef.current); keepAliveRef.current = null }
  }, [])

  const startKeepAlive = useCallback(() => {
    stopKeepAlive()
    keepAliveRef.current = window.setInterval(() => {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) window.speechSynthesis.resume()
    }, 4500)
  }, [stopKeepAlive])

  const finishSpeech = useCallback((utterance: SpeechSynthesisUtterance) => {
    if (utteranceRef.current !== utterance) return
    utteranceRef.current = null
    stopKeepAlive()
    stopLocalMeter()
    setIsSpeaking(false)
  }, [stopKeepAlive, stopLocalMeter])

  const stop = useCallback(() => {
    utteranceRef.current = null
    window.speechSynthesis.cancel()
    stopKeepAlive()
    stopLocalMeter()
    setIsSpeaking(false)
  }, [stopKeepAlive, stopLocalMeter])

  useEffect(() => stop, [stop])

  const unlockAudio = useCallback(() => {
    if (isUnlockedRef.current) return
    loadVoices()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
    window.setTimeout(() => { if (utteranceRef.current === null) window.speechSynthesis.cancel() }, 30)
    isUnlockedRef.current = true
  }, [loadVoices])

  const playComputerSpeech = useCallback((text: string) => {
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = selectComputerVoice()
    utterance.lang   = voice?.lang || 'pt-BR'
    if (voice) utterance.voice = voice
    utterance.rate   = 1.02
    utterance.pitch  = 0.86
    utterance.volume = 1

    utterance.onboundary = event => {
      if (utteranceRef.current !== utterance || !speechCursorRef.current) return
      speechCursorRef.current.boundaryIndex = event.charIndex
      speechCursorRef.current.boundaryAt = performance.now()
    }
    utterance.onstart = () => {
      if (utteranceRef.current !== utterance) return
      startLocalMeter(text)
      startKeepAlive()
      setIsSpeaking(true)
    }
    utterance.onend   = () => finishSpeech(utterance)
    utterance.onerror = () => finishSpeech(utterance)

    utteranceRef.current = utterance
    startLocalMeter(text)
    startKeepAlive()
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [finishSpeech, selectComputerVoice, startKeepAlive, startLocalMeter])

  const speak = useCallback(async (text: string) => {
    const cleanText = normalizeSpeechText(text)
    if (!cleanText) return
    stop()
    await wait(50)
    playComputerSpeech(cleanText)
  }, [playComputerSpeech, stop])

  return { speak, stop, isSpeaking, unlockAudio, audioMetrics, audioMetricsLiveRef }
}
