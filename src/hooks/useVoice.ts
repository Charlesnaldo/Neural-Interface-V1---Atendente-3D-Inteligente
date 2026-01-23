'use client'
import { useState } from 'react'

export const useVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false)

  const speak = (text: string) => {
    if (typeof window === 'undefined') return

    // Cancela falas anteriores
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = 1.2 // Velocidade um pouco mais humana

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  return { speak, isSpeaking }
}