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
  loading: boolean;
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

  // --- SOUND DESIGN (SFX) ---
  const playSFX = useCallback((type: 'beep' | 'process' | 'end') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      if (type === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'process') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      } else if (type === 'end') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      }
    } catch (e) { console.error("SFX Error", e) }
  }, [])

  // Analisador de Sentimento Automático
  const analyzeSentiment = useCallback((text: string) => {
    const positive = ["feliz", "bom", "ótimo", "alegre", "sorriso", "parabéns", "legal", "sim", "claro", "ajudar"]
    const negative = ["triste", "mal", "ruim", "erro", "falha", "infelizmente", "perdão", "desculpe", "difícil", "não"]
    const lower = text.toLowerCase()
    if (positive.some(word => lower.includes(word))) return 'smile'
    if (negative.some(word => lower.includes(word))) return 'sad'
    return 'neutral'
  }, [])

  const handleVisionDescription = useCallback((text: string) => {
    setLoading(false)
    playSFX('end')
    if (text) {
      setExpression(analyzeSentiment(text))
      speak(text)
    }
  }, [speak, analyzeSentiment, playSFX])

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

    playSFX('process')
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
        // Autosentimento: A IA decide a cara que vai fazer
        setExpression(analyzeSentiment(data.text))

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
  }, [loading, isSpeaking, speak, triggerDescription, analyzeSentiment, playSFX])

  const { isListening, toggleListening } = useSpeechToText(processMessage)

  const handleMicAction = () => {
    unlockAudio()
    // DUPLEX: Se eu clicar para falar e ele estiver falando, ele cala a boca na hora
    if (isSpeaking) {
      stop();
    }
    playSFX('beep')
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

      {/* Overlay do Criador - Design 3D Premium */}
      {showCreator && (
        <div className="absolute bottom-32 left-8 z-50 [perspective:1000px] animate-in slide-in-from-left-20 fade-in duration-700">
          <div className="relative group [transform:rotateY(10deg)rotateX(2deg)] hover:[transform:rotateY(0deg)rotateX(0deg)] transition-all duration-700">
            {/* Efeito de Brilho Dinâmico Traseiro */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 rounded-2xl blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>

            <div className="relative bg-neutral-900/80 backdrop-blur-2xl rounded-2xl p-2 border border-white/20 shadow-[25px_25px_50px_rgba(0,0,0,0.7)] flex flex-col sm:flex-row items-center gap-6 overflow-hidden">
              {/* Foto com Efeito de Profundidade */}
              <div className="relative shrink-0 [transform:translateZ(20px)]">
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10 rounded-lg"></div>
                <img
                  src="/perfil.jpg"
                  alt="Criador: Ronaldo Charles"
                  className="w-32 h-44 object-cover rounded-lg border border-white/10 shadow-xl grayscale-[20%] group-hover:grayscale-0 transition-all duration-500"
                />
              </div>

              {/* Informações em Camadas 3D */}
              <div className="pr-8 py-2 [transform:translateZ(50px)]">
                <div className="flex flex-col">
                  <span className="text-cyan-400 font-mono text-[7px] tracking-[0.4em] uppercase opacity-80 mb-2 block">DESENVOLVEDOR</span>
                  <h3 className="text-white font-black text-2xl tracking-tighter leading-[0.9] drop-shadow-2xl">
                    RONALDO<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/30">CHARLES</span>
                  </h3>
                </div>

                <div className="h-[3px] w-14 bg-gradient-to-r from-cyan-500 to-transparent rounded-full mt-5 shadow-[0_0_15px_rgba(6,182,212,0.4)]"></div>

                <div className="mt-6 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-[pulse_2s_infinite]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40 animate-[pulse_2s_infinite_200ms]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/10 animate-[pulse_2s_infinite_400ms]"></div>
                  </div>
                  <span className="text-white/30 font-mono text-[7px] tracking-widest uppercase">System Active</span>
                </div>
              </div>

              {/* Varredura de Brilho (Light Sweep) */}
              <div className="absolute top-0 -inset-full h-full w-1/2 z-20 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out"></div>
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
          <FaceScene isSpeaking={isSpeaking} loading={loading} faceCoords={faceCoords} expression={expression} />
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