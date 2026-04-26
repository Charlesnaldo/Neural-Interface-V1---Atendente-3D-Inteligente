'use client'

import { Vortex } from "@/components/ui/vortex"
import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { FaceSceneProps } from '@/components/canvas/FaceScene'

// --- DESIGNER (UI Components) ---
import { StatusHeader } from './interface/StatusHeader'
import { FaceDisplay } from './interface/FaceDisplay'
import { ChatControls } from './interface/ChatControls'

// --- ESTRUTURA (Business Logic / Hooks) ---
import { useVoice } from '@/hooks/useVoice'
import { useVision } from '@/hooks/useVision'
import { useSpeechToText } from '@/hooks/useSpeechToText'

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
type ChatRole = 'user' | 'assistant'
type ChatMessage = {
  role: ChatRole
  content: string
}

const STOP_VOICE_PHRASES = ['pare', 'cala', 'cala a boca', 'silêncio', 'silencio', 'fica quieto', 'quieto', 'quieta', 'desliga', 'para com isso']

const FaceScene = dynamic<FaceSceneProps>(
  () => import('@/components/canvas/FaceScene').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="text-cyan-500 font-mono text-xs">INICIALIZANDO VISÃO...</div> }
)


export default function AtendenteInterface() {
  // --- 1. ESTADOS (Estrutura de Dados) ---
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expression, setExpression] = useState<'neutral' | 'smile' | 'sad'>('neutral')
  const [showCreator, setShowCreator] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visionReport, setVisionReport] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [micEnabled, setMicEnabled] = useState(false)
  const stopListeningRef = useRef<() => void>(() => {})

  // --- 2. GESTORES DE LOGICA (Hooks) ---
  const { speak, stop, isSpeaking, unlockAudio, audioMetrics } = useVoice()

  // --- SOUND DESIGN (SFX) ---
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playSFX = useCallback((type: 'beep' | 'process' | 'end') => {
    try {
      if (!audioCtxRef.current) {
        const audioWindow = window as AudioWindow
        const AudioCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext
        if (!AudioCtor) return
        audioCtxRef.current = new AudioCtor()
      }

      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      const now = ctx.currentTime

      if (type === 'beep') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now)
        gain.gain.setValueAtTime(0.1, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
        osc.start(now)
        osc.stop(now + 0.1)
      } else if (type === 'process') {
        osc.type = 'square'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.2)
        gain.gain.setValueAtTime(0.05, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
        osc.start(now)
        osc.stop(now + 0.2)
      } else if (type === 'end') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(880, now)
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.1)
        gain.gain.setValueAtTime(0.05, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
        osc.start(now)
        osc.stop(now + 0.1)
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
    setVisionReport(text || '')
    if (text) {
      setExpression(analyzeSentiment(text))
      setChatHistory(prev => [...prev, { role: 'assistant', content: text }])
      speak(text)
    }
  }, [speak, analyzeSentiment, playSFX, setVisionReport])

  const { faceCoords, triggerDescription, visionStatus, recognizedFace } = useVision({
    onSpeak: handleVisionDescription,
    videoRef
  })


  // Efeito para sumir com o card do criador após 8 segundos
  useEffect(() => {
    if (showCreator) {
      const timer = setTimeout(() => setShowCreator(false), 6000)
      return () => clearTimeout(timer)
    }
  }, [showCreator])

  const lastSpeakEndTime = useRef(0)

  // Processamento de Mensagens
  const processMessage = useCallback(async (
    message: string,
    isVoice: boolean = false,
    options?: { allowWhileSpeaking?: boolean }
  ) => {
    // PROTEÇÃO ANTI-ECO: Apenas para voz, ignoramos se o Zord estiver falando ou se acabou de falar.
    const now = Date.now();
    const timeSinceLastSpeak = now - lastSpeakEndTime.current;
    const isRecentlySpoken = isVoice && timeSinceLastSpeak < 1200;

    const allowWhileSpeaking = options?.allowWhileSpeaking ?? false

    if (!message.trim() || loading || (!allowWhileSpeaking && isVoice && isSpeaking) || isRecentlySpoken) {
      if (isRecentlySpoken || (isVoice && isSpeaking)) {
        console.log(`>>> ZORD: Bloqueio de Eco [Voz]. Speaking: ${isSpeaking}, Recent: ${isRecentlySpoken}`);
      }
      return;
    }

    playSFX('process')
    const nextHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: message }]
    setChatHistory(nextHistory)
    const lowerMessage = message.toLowerCase();

    if (isVoice && STOP_VOICE_PHRASES.some(phrase => lowerMessage.includes(phrase))) {
      stop()
      stopListeningRef.current()
      setLoading(false)
      setInput('')
      return
    }

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
      const visionPayload = {
        description: visionReport || null,
        recognizedFace,
        status: visionStatus,
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: nextHistory,
          visionContext: visionPayload,
        }),
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
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.text }])
        speak(data.text)
      }
    } catch (err) {
      console.error("Erro neural:", err)
    } finally {
      setLoading(false)
      setInput('')
    }
  }, [loading, isSpeaking, speak, stop, triggerDescription, analyzeSentiment, playSFX, visionReport, recognizedFace, visionStatus, chatHistory])

  const { isListening, startListening, stopListening } = useSpeechToText(
    (text) => processMessage(text, true),
    isSpeaking,
    (text) => {
      stop()
      processMessage(text, true, { allowWhileSpeaking: true })
    }
  )
  useEffect(() => {
    stopListeningRef.current = stopListening
  }, [stopListening])

  // Ref para detectar o término da fala do Zord
  const lastIsSpeaking = useRef(false)

  // Efeito de Conversa Fluida (Auto-Microfone / Proteção Anti-Eco)
  const listenCooldown = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!micEnabled) {
      stopListening()
      if (listenCooldown.current) {
        clearTimeout(listenCooldown.current)
        listenCooldown.current = null
      }
      lastIsSpeaking.current = isSpeaking
      return
    }

    if (!isSpeaking && !loading && !isListening && !listenCooldown.current) {
      listenCooldown.current = setTimeout(() => {
        if (micEnabled && !isSpeaking && !loading && !isListening) {
          startListening();
        }
        if (listenCooldown.current) {
          clearTimeout(listenCooldown.current)
          listenCooldown.current = null
        }
      }, 150);
    }

    if (!lastIsSpeaking.current && isSpeaking) {
      lastSpeakEndTime.current = 0;
      stopListening();
      if (listenCooldown.current) {
        clearTimeout(listenCooldown.current)
        listenCooldown.current = null
      }
    }

    if (lastIsSpeaking.current && !isSpeaking && !loading) {
      lastSpeakEndTime.current = Date.now();
      listenCooldown.current = setTimeout(() => {
        if (!isListening) startListening();
      }, 450);
    }

    lastIsSpeaking.current = isSpeaking;
    return () => {
      if (listenCooldown.current) {
        clearTimeout(listenCooldown.current)
        listenCooldown.current = null
      }
    }
  }, [micEnabled, isSpeaking, loading, isListening, startListening, stopListening])

  const handleMicAction = () => {
    unlockAudio()
    setMicEnabled(true)
    // DUPLEX: Se eu clicar para falar e ele estiver falando, ele cala a boca na hora
    if (isSpeaking) {
      stop();
    }
    playSFX('beep')
    startListening()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    processMessage(input, false)
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
              {/* Foto com Efeito de Profundidade (A foto voltou!) */}
              <div className="relative shrink-0 [transform:translateZ(30px)]">
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10 rounded-lg"></div>
                <img
                  src="/perfil.jpg"
                  alt="Criador: Ronaldo Charles"
                  className="w-40 h-56 object-cover rounded-lg border border-white/10 shadow-xl grayscale-[20%] group-hover:grayscale-0 transition-all duration-500"
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
        {visionStatus !== 'online' && (
          <div className="absolute top-6 right-6 z-30 px-3 py-1 rounded-full border border-white/30 bg-neutral-900/70 text-[10px] tracking-[0.3em] uppercase text-orange-400">
            {visionStatus === 'connecting' ? 'Visão carregando...' : 'Visão offline'}
          </div>
        )}
        {recognizedFace && (
          <div className="absolute top-16 right-6 z-30 px-3 py-1 rounded-full border border-cyan-400 bg-neutral-900/70 text-[10px] tracking-[0.3em] uppercase text-cyan-200">
            {`Rosto reconhecido: ${recognizedFace}`}
          </div>
        )}

        <FaceDisplay isSpeaking={isSpeaking}>
          <FaceScene isSpeaking={isSpeaking} loading={loading} faceCoords={faceCoords} expression={expression} audioMetrics={audioMetrics} />
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
