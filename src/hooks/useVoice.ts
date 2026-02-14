'use client'
import * as THREE from 'three'
import { useCallback, useRef, useState } from 'react'

type ElevenLabsState = 'unknown' | 'available' | 'unavailable'

export const useVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioMetrics, setAudioMetrics] = useState({ amplitude: 0, sharpness: 0 })
  const isUnlockedRef = useRef(false)
  const elevenLabsStateRef = useRef<ElevenLabsState>('unknown')
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const remoteAudioUrlRef = useRef<string | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const localMeterRef = useRef<number | null>(null)
  const audioMetricsRef = useRef({ amplitude: 0, sharpness: 0 })

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
    audioMetricsRef.current = { amplitude: 0, sharpness: 0 }
    setAudioMetrics({ amplitude: 0, sharpness: 0 })
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
    audioMetricsRef.current = { amplitude: 0, sharpness: 0 }
    setAudioMetrics({ amplitude: 0, sharpness: 0 })
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
    audioMetricsRef.current = { amplitude: 0, sharpness: 0 }
    setAudioMetrics({ amplitude: 0, sharpness: 0 })
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
      analyser.fftSize = 256

      source.connect(analyser)
      analyser.connect(ctx.destination)

      analyserRef.current = analyser
      sourceRef.current = source
      const buffer = new Uint8Array(analyser.fftSize)

      const tick = () => {
        analyser.getByteTimeDomainData(buffer)
        const sum = buffer.reduce((acc, value) => acc + Math.abs(value - 128), 0)
        const normalized = sum / buffer.length / 128
        const highSplit = Math.floor(buffer.length * 0.6)
        const highSum = buffer
          .slice(highSplit)
          .reduce((acc, value) => acc + Math.abs(value - 128), 0)
        const sharpness = highSum / Math.max(1, buffer.length - highSplit) / 128

        const targetAmplitude = Math.min(1, normalized)
        const targetSharpness = Math.min(1, sharpness)
        const smoothedAmplitude =
          audioMetricsRef.current.amplitude * 0.8 + targetAmplitude * 0.2
        const smoothedSharpness =
          audioMetricsRef.current.sharpness * 0.8 + targetSharpness * 0.2
        audioMetricsRef.current = {
          amplitude: smoothedAmplitude,
          sharpness: smoothedSharpness,
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

    const tick = () => {
      const amp = 0.3 + Math.random() * 0.4
      const sharpness = 0.05 + Math.random() * 0.15
      audioMetricsRef.current = { amplitude: amp, sharpness }
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
        setAudioMetrics({ amplitude: 0, sharpness: 0 })
        return false
      }
    },
    [startAnalyser, stopRemoteAudio]
  )

  const speak = useCallback(
    async (text: string) => {
      if (!text) return

      stop()
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
