import { useState, useEffect, useRef, useCallback } from 'react'

type SpeechRecognitionErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'
  | string

interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence?: number
}

interface SpeechRecognitionResultLike {
  0?: SpeechRecognitionAlternativeLike
  isFinal?: boolean
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex?: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: SpeechRecognitionErrorCode
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives?: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

type BrowserSpeechWindow = Window & typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
  webkitAudioContext?: typeof AudioContext
}

const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  },
  video: false,
}

export const useSpeechToText = (
  onFinalTranscript: (text: string) => void,
  isSpeaking: boolean,
  onBargeIn?: (text: string) => void
) => {
  const [isListening, setIsListening] = useState(false)
  const [inputLevel, setInputLevel] = useState(0)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const isListeningRef = useRef(false)
  const isActiveRef = useRef(false)
  const isSpeakingRef = useRef(isSpeaking)
  const lastBargeInAtRef = useRef(0)
  const lastFinalRef = useRef({ text: '', at: 0 })
  const onFinalTranscriptRef = useRef(onFinalTranscript)
  const onBargeInRef = useRef(onBargeIn)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const inputFrameRef = useRef<number | null>(null)
  const restartTimerRef = useRef<number | null>(null)
  const inputLevelRef = useRef(0)
  const lastLevelEmitRef = useRef(0)

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript
  }, [onFinalTranscript])

  useEffect(() => {
    onBargeInRef.current = onBargeIn
  }, [onBargeIn])

  useEffect(() => {
    isSpeakingRef.current = isSpeaking
  }, [isSpeaking])

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const stopInputMeter = useCallback(() => {
    if (inputFrameRef.current) {
      cancelAnimationFrame(inputFrameRef.current)
      inputFrameRef.current = null
    }

    inputSourceRef.current?.disconnect()
    analyserRef.current?.disconnect()
    inputSourceRef.current = null
    analyserRef.current = null
    inputLevelRef.current = 0
    setInputLevel(0)
  }, [])

  const stopAudioCapture = useCallback(() => {
    stopInputMeter()
    audioStreamRef.current?.getTracks().forEach(track => track.stop())
    audioStreamRef.current = null

    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {})
    }
  }, [stopInputMeter])

  const startInputMeter = useCallback((stream: MediaStream) => {
    stopInputMeter()

    const speechWindow = window as BrowserSpeechWindow
    const AudioCtor = speechWindow.AudioContext || speechWindow.webkitAudioContext
    if (!AudioCtor) return

    const ctx = new AudioCtor()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.2
    source.connect(analyser)

    audioCtxRef.current = ctx
    inputSourceRef.current = source
    analyserRef.current = analyser

    const buffer = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(buffer)

      let sum = 0
      for (let i = 0; i < buffer.length; i++) {
        const normalized = (buffer[i] - 128) / 128
        sum += normalized * normalized
      }

      const rms = Math.sqrt(sum / Math.max(1, buffer.length))
      const targetLevel = Math.max(0, Math.min(1, (rms - 0.018) * 9))
      inputLevelRef.current = inputLevelRef.current * 0.72 + targetLevel * 0.28

      const now = performance.now()
      if (now - lastLevelEmitRef.current > 80) {
        lastLevelEmitRef.current = now
        setInputLevel(inputLevelRef.current)
      }

      inputFrameRef.current = requestAnimationFrame(tick)
    }

    tick()
  }, [stopInputMeter])

  const ensureAudioCapture = useCallback(async () => {
    const currentStream = audioStreamRef.current
    if (currentStream?.getAudioTracks().some(track => track.readyState === 'live')) {
      return true
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn('>>> VOZ: captura de microfone indisponivel neste navegador.')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS)
      audioStreamRef.current = stream
      startInputMeter(stream)
      return true
    } catch (error) {
      console.error('>>> VOZ: permissao/captura de microfone falhou:', error)
      stopAudioCapture()
      return false
    }
  }, [startInputMeter, stopAudioCapture])

  const handleResult = useCallback((event: SpeechRecognitionEventLike) => {
    const startIndex = event.resultIndex ?? Math.max(0, event.results.length - 1)
    const finalParts: string[] = []
    const interimParts: string[] = []
    let confidenceSum = 0
    let confidenceCount = 0

    for (let index = startIndex; index < event.results.length; index++) {
      const result = event.results[index]
      const alternative = result?.[0]
      if (!alternative) continue

      const transcript = alternative.transcript.trim()
      if (!transcript) continue

      if (typeof alternative.confidence === 'number') {
        confidenceSum += alternative.confidence
        confidenceCount += 1
      }

      if (result.isFinal) {
        finalParts.push(transcript)
      } else {
        interimParts.push(transcript)
      }
    }

    const finalTranscript = finalParts.join(' ').trim()
    const interimTranscript = interimParts.join(' ').trim()
    const liveTranscript = finalTranscript || interimTranscript
    if (!liveTranscript) return

    const confidence = confidenceCount ? confidenceSum / confidenceCount : 0
    const bargeInHandler = onBargeInRef.current
    const canUseLowConfidence = confidence === 0 || confidence >= 0.38
    const canBargeIn =
      Boolean(bargeInHandler) &&
      isSpeakingRef.current &&
      canUseLowConfidence &&
      Date.now() - lastBargeInAtRef.current > 900

    if (canBargeIn && bargeInHandler) {
      lastBargeInAtRef.current = Date.now()
      bargeInHandler(liveTranscript)
      return
    }

    if (!finalTranscript) return

    const normalizedFinal = finalTranscript.toLowerCase()
    if (lastFinalRef.current.text === normalizedFinal && Date.now() - lastFinalRef.current.at < 1200) {
      return
    }

    lastFinalRef.current = { text: normalizedFinal, at: Date.now() }
    onFinalTranscriptRef.current(finalTranscript)
  }, [])

  const beginRecognition = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || isActiveRef.current || isSpeakingRef.current) return

    try {
      recognition.start()
    } catch {
      console.warn('>>> VOZ: tentativa de start ignorada, reconhecimento ja ativo.')
    }
  }, [])

  const stopListening = useCallback(() => {
    clearRestartTimer()
    isListeningRef.current = false
    setIsListening(false)
    stopAudioCapture()

    if (recognitionRef.current && isActiveRef.current) {
      try {
        recognitionRef.current.abort()
      } catch (error) {
        console.error('>>> VOZ: erro ao parar:', error)
      }
    }
  }, [clearRestartTimer, stopAudioCapture])

  const startListening = useCallback(() => {
    if (isSpeakingRef.current) return
    if (!recognitionRef.current) {
      console.warn('>>> VOZ: reconhecimento de fala indisponivel neste navegador.')
      return
    }

    clearRestartTimer()
    isListeningRef.current = true
    setIsListening(true)

    void ensureAudioCapture().then((ready) => {
      if (!ready) {
        isListeningRef.current = false
        setIsListening(false)
        return
      }

      if (isListeningRef.current && !isSpeakingRef.current) {
        beginRecognition()
      }
    })
  }, [beginRecognition, clearRestartTimer, ensureAudioCapture])

  useEffect(() => {
    const speechWindow = window as BrowserSpeechWindow
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (SpeechRecognition && !recognitionRef.current) {
      const recog = new SpeechRecognition()
      recog.continuous = true
      recog.interimResults = true
      recog.maxAlternatives = 1
      recog.lang = 'pt-BR'

      recog.onstart = () => {
        isActiveRef.current = true
        isListeningRef.current = true
        setIsListening(true)
      }

      recog.onresult = handleResult

      recog.onerror = event => {
        if (event.error === 'network' || event.error === 'no-speech' || event.error === 'aborted') return

        console.error('>>> VOZ: erro:', event.error)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
          isListeningRef.current = false
          setIsListening(false)
          stopAudioCapture()
        }
      }

      recog.onend = () => {
        isActiveRef.current = false
        clearRestartTimer()

        if (isListeningRef.current && !isSpeakingRef.current) {
          restartTimerRef.current = window.setTimeout(() => {
            if (isListeningRef.current && !isActiveRef.current && !isSpeakingRef.current) {
              beginRecognition()
            }
          }, 280)
        }
      }

      recognitionRef.current = recog
    }

    return () => {
      clearRestartTimer()
      recognitionRef.current?.stop()
      recognitionRef.current = null
      isActiveRef.current = false
      isListeningRef.current = false
      stopAudioCapture()
    }
  }, [beginRecognition, clearRestartTimer, handleResult, stopAudioCapture])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      startListening()
    }
  }, [startListening, stopListening])

  return { isListening, inputLevel, toggleListening, startListening, stopListening }
}
