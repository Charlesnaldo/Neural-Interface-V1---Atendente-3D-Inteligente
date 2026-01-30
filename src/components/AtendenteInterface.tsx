'use client'

import { Vortex } from "@/components/ui/vortex"
import { useState, useRef, useCallback, useEffect } from 'react'
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
  expression: 'neutral' | 'smile' | 'sad';
}

const FaceScene = dynamic<FaceSceneProps>(
  () => import('@/components/canvas/FaceScene'),
  { ssr: false, loading: () => <div className="text-cyan-500 font-mono text-xs">INICIALIZANDO VISÃO...</div> }
)

export default function AtendenteInterface() {
  // --- 1. ESTADOS (Estrutura de Dados) ---
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expression, setExpression] = useState<'neutral' | 'smile' | 'sad'>('neutral')
  const [showCreator, setShowCreator] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // --- 2. GESTORES DE LOGICA (Hooks) ---
  const { speak, stop, isSpeaking, unlockAudio } = useVoice()

  const handleVisionDescription = useCallback((text: string) => {
    setLoading(false)
    if (text) speak(text)
  }, [speak])

  const { faceCoords, triggerDescription } = useVision({
    onSpeak: handleVisionDescription,
    videoRef
  })

  // Efeito para sumir com a foto do criador após 5 segundos
  useEffect(() => {
    if (showCreator) {
      const timer = setTimeout(() => setShowCreator(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showCreator])

  // Processamento de Mensagens
  const processMessage = useCallback(async (message: string) => {
    if (!message.trim() || loading || isSpeaking) return;

    const lowerMessage = message.toLowerCase();

    // Gatilho do Criador
    if (lowerMessage.includes("criador") || lowerMessage.includes("quem é seu criado") || lowerMessage.includes("ronaldo charles")) {
      setShowCreator(true)
    }

    // Controle de Expressão Manual via Gatilho
    if (lowerMessage.includes("sorri") || lowerMessage.includes("feliz") || lowerMessage.includes("alegre")) {
      setExpression('smile')
    } else if (lowerMessage.includes("triste") || lowerMessage.includes("baixo") || lowerMessage.includes("chorar")) {
      setExpression('sad')
    } else if (lowerMessage.includes("normal") || lowerMessage.includes("neutro")) {
      setExpression('neutral')
    }

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
      if (data.text) {
        // Se a resposta da IA mencionar o criador, mostra a foto
        const lowerRes = data.text.toLowerCase()
        if (lowerRes.includes("ronaldo charles") || lowerRes.includes("criador")) {
          setShowCreator(true)
        }
        speak(data.text)
      }
    } catch (err) {
      console.error("Erro neural:", err)
    } finally {
      setLoading(false)
      setInput('')
    }
  }, [loading, isSpeaking, speak, triggerDescription])

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

      {/* Overlay do Criador - Reposicionado para o Canto Inferior Esquerdo */}
      {showCreator && (
        <div className="absolute bottom-32 left-8 z-50 flex items-center justify-start transition-all duration-500 animate-in slide-in-from-left-10 fade-in zoom-in">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-25"></div>
            <div className="relative bg-black/80 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 shadow-2xl flex flex-col sm:flex-row items-center gap-4">
              <img
                src="/perfil.jpg"
                alt="Criador: Ronaldo Charles"
                className="w-32 h-40 object-cover rounded-xl border border-white/5"
              />
              <div className="pr-6 py-2">
                <p className="text-cyan-400 font-mono text-[8px] tracking-[0.2em] uppercase mb-1">Developer</p>
                <h3 className="text-white font-bold text-sm tracking-tight">Ronaldo Charles</h3>
                <div className="h-[1px] w-full bg-gradient-to-r from-cyan-500/50 to-transparent mt-2"></div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <FaceScene isSpeaking={isSpeaking} faceCoords={faceCoords} expression={expression} />
        </FaceDisplay>

        <ChatControls
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          startListening={handleMicAction}
          onStop={stop}
          isListening={isListening}
          loading={loading}
          isSpeaking={isSpeaking}
        />
      </Vortex>
    </main>
  )
}