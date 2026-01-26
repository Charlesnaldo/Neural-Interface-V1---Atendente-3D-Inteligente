'use client'
import { useState, useRef } from 'react'

export const useVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const speak = async (text: string) => {
    try {
      setIsSpeaking(true)

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) throw new Error("Erro ao gerar voz")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      // Toca o áudio
      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(url)
      audioRef.current = audio
      
      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url) 
      }

      await audio.play()
    } catch (error) {
      console.error("Voz Profissional falhou:", error)
      setIsSpeaking(false)
    }
  }

  return { speak, isSpeaking }
}