'use client'
import { useState, useCallback, useRef } from 'react'

export const useVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  
  const speakRobotic = useCallback((text: string) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = 1.0
    utterance.pitch = 0.5 
    
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [])

  
  const speak = useCallback(async (text: string) => {
    if (!text) return
    setIsSpeaking(true)

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      
      if (!response.ok) {
        throw new Error("Cota ElevenLabs atingida ou erro na API")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(url)
      audioRef.current = audio
      
      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
      }

      await audio.play()

    } catch (error) {
      console.warn(">>> ZORD: ElevenLabs offline/sem cota. Ativando voz robótica de backup.")
      
      speakRobotic(text)
    }
  }, [speakRobotic])

  return { speak, isSpeaking }
}