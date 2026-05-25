'use client'

import * as THREE from 'three'
import { useCallback, useEffect, useRef, useState } from 'react'

type DominantBand = 'low' | 'mid' | 'high'

interface AudioMetrics {
  amplitude: number
  sharpness: number
  low: number
  mid: number
  high: number
  dominantBand: DominantBand
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
  amplitude: 0,
  sharpness: 0,
  low: 0,
  mid: 0,
  high: 0,
  dominantBand: 'mid',
}

const normalizeSpeechText = (text: string) => text.replace(/\s+/g, ' ').trim()

const simplifyChar = (char: string) =>
  char
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

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

  const loadVoices = useCallback(() => {
    voicesRef.current = window.speechSynthesis.getVoices()
  }, [])

  useEffect(() => {
    loadVoices()

    const synth = window.speechSynthesis
    const previousHandler = synth.onvoiceschanged
    const handleVoicesChanged = (event: Event) => {
      previousHandler?.call(synth, event)
      loadVoices()
    }

    synth.onvoiceschanged = handleVoicesChanged
    return () => {
      if (synth.onvoiceschanged === handleVoicesChanged) {
        synth.onvoiceschanged = previousHandler
      }
    }
  }, [loadVoices])

  const selectComputerVoice = useCallback(() => {
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices()
    const isPtBr = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replace('_', '-').startsWith('pt-br')
    const isPt = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().startsWith('pt')

    return (
      voices.find(voice => voice.localService && isPtBr(voice)) ||
      voices.find(voice => voice.localService && isPt(voice)) ||
      voices.find(isPtBr) ||
      voices.find(isPt) ||
      voices.find(voice => voice.localService) ||
      voices[0] ||
      null
    )
  }, [])

  const stopLocalMeter = useCallback(() => {
    if (meterFrameRef.current) {
      cancelAnimationFrame(meterFrameRef.current)
      meterFrameRef.current = null
    }

    speechCursorRef.current = null
    audioMetricsRef.current = ZERO_METRICS
    setAudioMetrics(ZERO_METRICS)
  }, [])

  const startLocalMeter = useCallback((text: string) => {
    stopLocalMeter()

    const cursor = createSpeechCursor(text)
    speechCursorRef.current = cursor

    const tick = () => {
      const activeCursor = speechCursorRef.current
      if (!activeCursor) return

      const now = performance.now()
      const elapsed = now - activeCursor.startedAt
      const progress = THREE.MathUtils.clamp(elapsed / activeCursor.estimatedDuration, 0, 1)
      const fallbackIndex = Math.floor(progress * Math.max(1, activeCursor.text.length - 1))
      const boundaryIndex = activeCursor.boundaryIndex + Math.floor((now - activeCursor.boundaryAt) / 58)
      const charIndex = THREE.MathUtils.clamp(Math.max(fallbackIndex, boundaryIndex), 0, Math.max(0, activeCursor.text.length - 1))
      const rawChar = activeCursor.text[charIndex] || 'a'
      const char = simplifyChar(rawChar)
      const isPause = /[\s,.!?;:]/.test(rawChar)

      const phase = elapsed / 1000 * (7.2 + activeCursor.text.length * 0.018) + activeCursor.phaseOffset
      const syllablePulse = Math.pow(Math.max(0, Math.sin(phase * Math.PI)), 0.72)
      const phrasePulse = 0.5 + Math.sin(phase * 0.42) * 0.5
      const fade = THREE.MathUtils.clamp(Math.min(progress / 0.06, (1 - progress) / 0.08), 0, 1)
      const bands = getBandsForChar(char)

      const amplitudeTarget = THREE.MathUtils.clamp(
        (isPause ? 0.08 : 0.16 + syllablePulse * 0.64 + phrasePulse * 0.08) * fade,
        0,
        1
      )
      const low = THREE.MathUtils.clamp(bands.low * amplitudeTarget + 0.02, 0, 1)
      const mid = THREE.MathUtils.clamp(bands.mid * amplitudeTarget + 0.03, 0, 1)
      const high = THREE.MathUtils.clamp(bands.high * amplitudeTarget + 0.015, 0, 1)
      const spectrumTotal = Math.max(0.001, low + mid + high)
      const sharpness = THREE.MathUtils.clamp((high * 1.18 + mid * 0.28) / spectrumTotal, 0, 1)

      audioMetricsRef.current = {
        amplitude: smoothValue(audioMetricsRef.current.amplitude, amplitudeTarget, 0.42, 0.18),
        sharpness: smoothValue(audioMetricsRef.current.sharpness, sharpness, 0.34, 0.12),
        low: smoothValue(audioMetricsRef.current.low, low, 0.34, 0.12),
        mid: smoothValue(audioMetricsRef.current.mid, mid, 0.34, 0.12),
        high: smoothValue(audioMetricsRef.current.high, high, 0.36, 0.12),
        dominantBand: getDominantBand(low, mid, high),
      }

      setAudioMetrics(audioMetricsRef.current)
      meterFrameRef.current = requestAnimationFrame(tick)
    }

    tick()
  }, [stopLocalMeter])

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      window.clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  const startKeepAlive = useCallback(() => {
    stopKeepAlive()
    keepAliveRef.current = window.setInterval(() => {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
      }
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
    const utterance = new SpeechSynthesisUtterance(' ')
    utterance.volume = 0
    window.speechSynthesis.speak(utterance)
    window.setTimeout(() => {
      if (utteranceRef.current === null) {
        window.speechSynthesis.cancel()
      }
    }, 30)

    isUnlockedRef.current = true
    console.log('>>> ZORD: voz local do computador desbloqueada.')
  }, [loadVoices])

  const playComputerSpeech = useCallback((text: string) => {
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = selectComputerVoice()

    utterance.lang = voice?.lang || 'pt-BR'
    if (voice) utterance.voice = voice
    utterance.rate = 1.02
    utterance.pitch = 0.86
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
    utterance.onend = () => finishSpeech(utterance)
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

  return { speak, stop, isSpeaking, unlockAudio, audioMetrics }
}
