'use client'
import * as THREE from 'three'
import { useCallback, useRef, useState } from 'react'

type ElevenLabsState = 'unknown' | 'available' | 'unavailable'
type DominantBand = 'low' | 'mid' | 'high'

interface AudioMetrics {
  amplitude: number
  sharpness: number
  low: number
  mid: number
  high: number
  dominantBand: DominantBand
}

const ZERO_METRICS: AudioMetrics = {
  amplitude: 0,
  sharpness: 0,
  low: 0,
  mid: 0,
  high: 0,
  dominantBand: 'mid',
}

export const useVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics>(ZERO_METRICS)
  const isUnlockedRef = useRef(false)
  const elevenLabsStateRef = useRef<ElevenLabsState>('unknown')
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const remoteAudioUrlRef = useRef<string | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const localMeterRef = useRef<number | null>(null)
  const audioMetricsRef = useRef<AudioMetrics>(ZERO_METRICS)

  const smoothValue = (current: number, next: number, attack = 0.3, release = 0.12) => {
    const factor = next > current ? attack : release
    return current * (1 - factor) + next * factor
  }

  const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

  const unlockAudio = useCallback(() => {
    if (isUnlockedRef.current) return

    const utterance = new SpeechSynthesisUtterance('')
    window.speechSynthesis.speak(utterance)

    isUnlockedRef.current = true
    console.log('>>> ZORD: Sistemas de voz locais desbloqueados.')
  }, [])

  const stopLocalMeter = useCallback(() => {
    if (localMeterRef.current) {
      window.clearTimeout(localMeterRef.current)
      localMeterRef.current = null
    }
    audioMetricsRef.current = ZERO_METRICS
    setAudioMetrics(ZERO_METRICS)
  }, [])

  const stopAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    analyserRef.current?.disconnect()
    sourceRef.current?.disconnect()
    analyserRef.current = null
    sourceRef.current = null
    audioMetricsRef.current = ZERO_METRICS
    setAudioMetrics(ZERO_METRICS)
  }, [])

  const stopRemoteAudio = useCallback(() => {
    stopAnalyser()
    const audio = remoteAudioRef.current
    if (!audio) {
      return
    }
    audio.pause()
    audio.currentTime = 0
    const url = remoteAudioUrlRef.current || audio.src
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
    remoteAudioRef.current = null
    remoteAudioUrlRef.current = null
    audioMetricsRef.current = ZERO_METRICS
    setAudioMetrics(ZERO_METRICS)
  }, [stopAnalyser])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    stopRemoteAudio()
    stopLocalMeter()
    setIsSpeaking(false)
  }, [stopRemoteAudio, stopLocalMeter])

  const startAnalyser = useCallback(
    (audio: HTMLAudioElement) => {
      stopAnalyser()

      const ctx = audioCtxRef.current || new AudioContext()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }

      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.18

      source.connect(analyser)
      analyser.connect(ctx.destination)

      analyserRef.current = analyser
      sourceRef.current = source
      const timeBuffer = new Uint8Array(analyser.fftSize)
      const freqBuffer = new Uint8Array(analyser.frequencyBinCount)
      const nyquist = ctx.sampleRate / 2
      const hzPerBin = nyquist / analyser.frequencyBinCount

      const bandAverage = (fromHz: number, toHz: number) => {
        const start = Math.max(0, Math.floor(fromHz / hzPerBin))
        const end = Math.min(freqBuffer.length - 1, Math.ceil(toHz / hzPerBin))
        if (end <= start) return 0
        let sum = 0
        let count = 0
        for (let i = start; i <= end; i++) {
          sum += freqBuffer[i]
          count += 1
        }
        return count ? sum / count / 255 : 0
      }

      const tick = () => {
        analyser.getByteTimeDomainData(timeBuffer)
        analyser.getByteFrequencyData(freqBuffer)

        let rmsAccumulator = 0
        for (let i = 0; i < timeBuffer.length; i++) {
          const normalized = (timeBuffer[i] - 128) / 128
          rmsAccumulator += normalized * normalized
        }
        const rms = Math.sqrt(rmsAccumulator / Math.max(1, timeBuffer.length))
        const low = THREE.MathUtils.clamp(bandAverage(80, 450), 0, 1)
        const mid = THREE.MathUtils.clamp(bandAverage(450, 1800), 0, 1)
        const high = THREE.MathUtils.clamp(bandAverage(1800, 7500), 0, 1)
        const spectrumTotal = Math.max(0.001, low + mid + high)
        const sharpness = THREE.MathUtils.clamp((high * 1.2 + mid * 0.35) / spectrumTotal, 0, 1)

        const dominantBand: DominantBand =
          high >= mid && high >= low ? 'high' : mid >= low ? 'mid' : 'low'

        const targetAmplitude = THREE.MathUtils.clamp(rms * 2.4 + mid * 0.35, 0, 1)
        audioMetricsRef.current = {
          amplitude: smoothValue(audioMetricsRef.current.amplitude, targetAmplitude, 0.36, 0.14),
          sharpness: smoothValue(audioMetricsRef.current.sharpness, sharpness, 0.3, 0.1),
          low: smoothValue(audioMetricsRef.current.low, low, 0.28, 0.1),
          mid: smoothValue(audioMetricsRef.current.mid, mid, 0.28, 0.1),
          high: smoothValue(audioMetricsRef.current.high, high, 0.3, 0.1),
          dominantBand,
        }
        setAudioMetrics(audioMetricsRef.current)
        animationFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    },
    [stopAnalyser]
  )

  const startLocalMeter = useCallback(() => {
    stopLocalMeter()

    let localPhase = 0
    const tick = () => {
      localPhase += 0.3 + Math.random() * 0.4
      const low = THREE.MathUtils.clamp(0.15 + Math.abs(Math.sin(localPhase * 0.5)) * 0.35, 0, 1)
      const mid = THREE.MathUtils.clamp(0.2 + Math.abs(Math.sin(localPhase * 0.9)) * 0.45, 0, 1)
      const high = THREE.MathUtils.clamp(0.1 + Math.abs(Math.sin(localPhase * 1.3)) * 0.3, 0, 1)
      const amplitude = THREE.MathUtils.clamp(mid * 0.6 + low * 0.25 + Math.random() * 0.2, 0, 1)
      const sharpness = THREE.MathUtils.clamp((high * 1.1 + mid * 0.2) / Math.max(0.001, low + mid + high), 0, 1)
      const dominantBand: DominantBand =
        high >= mid && high >= low ? 'high' : mid >= low ? 'mid' : 'low'

      audioMetricsRef.current = { amplitude, sharpness, low, mid, high, dominantBand }
      setAudioMetrics(audioMetricsRef.current)
      localMeterRef.current = window.setTimeout(tick, 150 + Math.random() * 150)
    }
    tick()
  }, [stopLocalMeter])

  const playLocalSpeech = useCallback(
    (text: string) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'

      const voices = window.speechSynthesis.getVoices()
      const brVoice =
        voices.find(v => v.lang.includes('pt-BR') && v.name.includes('Online')) ||
        voices.find(v => v.lang.includes('pt-BR'))

      if (brVoice) utterance.voice = brVoice

      utterance.rate = 1.0
      utterance.pitch = 1.0

      utterance.onstart = () => {
        startLocalMeter()
        setIsSpeaking(true)
      }
      utterance.onend = () => {
        stopLocalMeter()
        setIsSpeaking(false)
      }
      utterance.onerror = () => {
        stopLocalMeter()
        setIsSpeaking(false)
      }

      window.speechSynthesis.speak(utterance)
    },
    [startLocalMeter, stopLocalMeter]
  )

  const speakElevenLabs = useCallback(
    async (text: string) => {
      let url: string | null = null
      let audio: HTMLAudioElement | null = null
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })

        if (!res.ok) {
          throw new Error(`TTS ElevenLabs retornou ${res.status}`)
        }

        const blob = await res.blob()
        url = URL.createObjectURL(blob)

        stopRemoteAudio()

        remoteAudioUrlRef.current = url
        audio = new Audio(url)
        remoteAudioRef.current = audio

        audio.onplay = () => {
          setIsSpeaking(true)
          if (audio) startAnalyser(audio)
        }
        audio.onended = () => {
          setIsSpeaking(false)
          if (remoteAudioRef.current === audio) {
            remoteAudioRef.current = null
            remoteAudioUrlRef.current = null
          }
          stopAnalyser()
        }
        audio.onerror = event => {
          console.error('Erro ao reproduzir áudio da ElevenLabs', event)
          setIsSpeaking(false)
          stopRemoteAudio()
        }

        await audio.play()
        elevenLabsStateRef.current = 'available'
        return true
      } catch (error) {
        if (audio && remoteAudioRef.current === audio) {
          remoteAudioRef.current = null
          remoteAudioUrlRef.current = null
        }
        if (url) {
          URL.revokeObjectURL(url)
        }
        console.error('Falha ElevenLabs TTS:', error)
        elevenLabsStateRef.current = 'unavailable'
        setAudioMetrics(ZERO_METRICS)
        return false
      }
    },
    [startAnalyser, stopAnalyser, stopRemoteAudio]
  )

  const speak = useCallback(
    async (text: string) => {
      if (!text) return

      stop()
      const delay = THREE.MathUtils.clamp(
        130 + Math.min(180, text.length * 1.5) + (/[?.!]/.test(text) ? 40 : 0),
        130,
        340
      )
      await wait(delay)

      if (elevenLabsStateRef.current !== 'unavailable') {
        const success = await speakElevenLabs(text)
        if (success) return
      }

      playLocalSpeech(text)
    },
    [playLocalSpeech, stop, speakElevenLabs]
  )

  return { speak, stop, isSpeaking, unlockAudio, audioMetrics }
}
