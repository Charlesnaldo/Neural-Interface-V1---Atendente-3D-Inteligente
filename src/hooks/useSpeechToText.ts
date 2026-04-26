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
  0: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: SpeechRecognitionErrorCode
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
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
}

export const useSpeechToText = (
  onFinalTranscript: (text: string) => void,
  isSpeaking: boolean,
  onBargeIn?: (text: string) => void
) => {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const isListeningRef = useRef(false)
  const isActiveRef = useRef(false)
  const isSpeakingRef = useRef(isSpeaking)
  const lastBargeInAtRef = useRef(0)

  const handleResult = useCallback((event: SpeechRecognitionEventLike) => {
    const lastIndex = event.results.length - 1
    if (lastIndex < 0) return

    const result = event.results[lastIndex]?.[0]
    const transcript = result?.transcript?.trim()
    if (transcript) {
      const confidence = result?.confidence ?? 0
      const allowBargeIn = isSpeakingRef.current && onBargeIn && confidence >= 0.55 && Date.now() - lastBargeInAtRef.current > 1200
      if (allowBargeIn) {
        lastBargeInAtRef.current = Date.now()
        onBargeIn(transcript)
        return
      }
      onFinalTranscript(transcript)
    }
  }, [onBargeIn, onFinalTranscript])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    setIsListening(false)

    if (recognitionRef.current && isActiveRef.current) {
      try {
        recognitionRef.current.abort()
      } catch (error) {
        console.error('>>> VOZ: Erro ao parar:', error)
      }
    }
  }, [])

  const startListening = useCallback(() => {
    if (isSpeakingRef.current) return
    if (!recognitionRef.current) return

    isListeningRef.current = true
    setIsListening(true)

    if (!isActiveRef.current) {
      try {
        recognitionRef.current.start()
      } catch {
        console.warn('>>> VOZ: Tentativa de start ignorada (ja ativo).')
      }
    }
  }, [])

  useEffect(() => {
    isSpeakingRef.current = isSpeaking
  }, [isSpeaking])

  useEffect(() => {
    const speechWindow = window as BrowserSpeechWindow
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (SpeechRecognition && !recognitionRef.current) {
      const recog = new SpeechRecognition()
      recog.continuous = true
      recog.interimResults = false
      recog.lang = 'pt-BR'

      recog.onstart = () => {
        isActiveRef.current = true
      }

      recog.onresult = handleResult

      recog.onerror = event => {
        if (event.error === 'network' || event.error === 'no-speech') return

        console.error('>>> VOZ: Erro:', event.error)
        isListeningRef.current = false
        setIsListening(false)
      }

      recog.onend = () => {
        isActiveRef.current = false
        if (isListeningRef.current && !isSpeakingRef.current) {
          window.setTimeout(() => {
            if (isListeningRef.current && !isActiveRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start()
              } catch {
                // noop
              }
            }
          }, 400)
        }
      }

      recognitionRef.current = recog
    }

    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      isActiveRef.current = false
      isListeningRef.current = false
    }
  }, [handleResult])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      startListening()
    }
  }, [startListening, stopListening])

  return { isListening, toggleListening, startListening, stopListening }
}
