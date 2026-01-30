'use client'

import { Vortex } from "@/components/ui/vortex"
import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

// --- DESIGNER (UI Components) ---
import { StatusHeader } from './interface/StatusHeader'
import { FaceDisplay } from './interface/FaceDisplay'
import { ChatControls } from './interface/ChatControls'

// --- ESTRUTURA (Business Logic / Hooks) ---
import { useVoice } from '@/hooks/useVoice'
import { useVision } from '@/hooks/useVision'
import { useSpeechToText } from '@/hooks/useSpeechToText'

// Tipagem para o componente dinâmico
interface FaceSceneProps {
  isSpeaking: boolean;
  faceCoords: { x: number; y: number };
}

const FaceScene = dynamic<FaceSceneProps>(
  () => import('@/components/canvas/FaceScene'),
  { ssr: false, loading: () => <div className="text-cyan-500 font-mono text-xs">INICIALIZANDO VISÃO...</div> }
)

export default function AtendenteInterface() {
  // --- 1. ESTADOS (Estrutura de Dados) ---
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // --- 2. GESTORES DE LOGICA (Hooks) ---
  const { speak, isSpeaking, unlockAudio } = useVoice()

  const handleVisionDescription = useCallback((text: string) => {
    setLoading(false)
    if (text) speak(text)
  }, [speak])

  const { faceCoords, triggerDescription } = useVision({
    onSpeak: handleVisionDescription,
    videoRef
  })

  // Processamento de Mensagens
  const processMessage = async (message: string) => {
    if (!message.trim() || loading || isSpeaking) return;

    const lowerMessage = message.toLowerCase();

    // Gatilho de Visão
    if (lowerMessage.includes("descreva") || lowerMessage.includes("escanear") || lowerMessage.includes("veja")) {
      setLoading(true)
      speak("Iniciando varredura óptica.")
      triggerDescription()
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (data.text) speak(data.text)
    } catch (err) {
      console.error("Erro neural:", err)
    } finally {
      setLoading(false)
      setInput('')
    }
  }

  const { isListening, toggleListening } = useSpeechToText(processMessage)

  const handleMicAction = () => {
    unlockAudio()
    toggleListening()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    processMessage(input)
  }

  // --- 3. COMPOSIÇÃO (Designer) ---
  return (
    <main className="h-screen w-full bg-black overflow-hidden flex items-center justify-center relative">
      <video ref={videoRef} autoPlay playsInline className="hidden" />

      <Vortex
        backgroundColor="black"
        rangeY={800}
        particleCount={300}
        baseSpeed={0.2}
        containerClassName="bg-black"
        className="flex items-center justify-center flex-col w-full h-full"
      >
        <StatusHeader
          isSpeaking={isSpeaking}
          isListening={isListening}
          loading={loading}
        />

        <FaceDisplay isSpeaking={isSpeaking}>
          <FaceScene isSpeaking={isSpeaking} faceCoords={faceCoords} />
        </FaceDisplay>

        <ChatControls
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          startListening={handleMicAction}
          isListening={isListening}
          loading={loading}
          isSpeaking={isSpeaking}
        />
      </Vortex>
    </main>
  )
}