'use client'
import { useState, useCallback, useRef } from 'react'

export const useVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isUnlockedRef = useRef(false) // Rastreia se o áudio já foi liberado

  // --- FUNÇÃO PARA DESBLOQUEAR ÁUDIO NO IPHONE ---
  // Esta função deve ser chamada no onClick do botão de microfone
  const unlockAudio = useCallback(() => {
    if (isUnlockedRef.current) return;
    
    // Cria um buffer silencioso para enganar o iOS
    const utterance = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(utterance);
    
    const audio = new Audio();
    audio.play().then(() => {
      audio.pause();
      isUnlockedRef.current = true;
      console.log("Sistemas de áudio desbloqueados para iOS");
    }).catch(() => {});
  }, []);

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

      if (!response.ok) throw new Error("Cota ElevenLabs atingida")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      if (audioRef.current) audioRef.current.pause()
      
      const audio = new Audio(url)
      audioRef.current = audio
      
      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
      }

      // No iOS, play() só funciona se unlockAudio foi chamado antes
      await audio.play()

    } catch (error) {
      console.warn(">>> ZORD: Backup robótico ativado.")
      speakRobotic(text)
    }
  }, [speakRobotic])

  // Retornamos o unlockAudio para ser usado no botão
  return { speak, isSpeaking, unlockAudio }
}