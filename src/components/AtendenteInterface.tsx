'use client'

import { Vortex } from '@/components/ui/vortex'
import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react'
import dynamic from 'next/dynamic'
import type { FaceSceneProps } from '@/components/canvas/FaceScene'
import { PROFILES, type Profile } from '@/data/profiles'

// --- DESIGNER (UI Components) ---
import { StatusHeader } from './interface/StatusHeader'
import { FaceDisplay } from './interface/FaceDisplay'
import { ChatControls } from './interface/ChatControls'
import { ProfileCard } from './interface/ProfileCard'

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
type Expression = FaceSceneProps['expression']

const STOP_VOICE_PHRASES = ['pare', 'cala', 'cala a boca', 'silêncio', 'fica quieto', 'quieto', 'quieta', 'desliga', 'para com isso']
const POSITIVE_WORDS = ['feliz', 'bom', 'ótimo', 'alegre', 'sorriso', 'parabéns', 'legal', 'sim', 'claro', 'ajudar']
const NEGATIVE_WORDS = ['triste', 'mal', 'ruim', 'erro', 'falha', 'infelizmente', 'perdão', 'desculpe', 'difícil', 'não']
const VISION_TRIGGERS = ['descreva', 'escanear', 'veja']
const CREATOR_FALLBACK_TRIGGERS = ['quem e seu criado', 'quem e seu criador', 'quem criou voce', 'quem criou você', 'quem te criou']
const CREATOR_PROFILE = PROFILES.find(profile => profile.id === 'ronaldo-charles') ?? PROFILES[0]

const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const includesAny = (text: string, terms: string[]) =>
  terms.some(term => text.includes(normalizeText(term)))

const analyzeSentiment = (text: string): Expression => {
  const normalized = normalizeText(text)
  if (includesAny(normalized, POSITIVE_WORDS)) return 'smile'
  if (includesAny(normalized, NEGATIVE_WORDS)) return 'sad'
  return 'neutral'
}

const findMentionedProfile = (text: string): Profile | null => {
  const normalized = normalizeText(text)
  const profile = PROFILES.find(item =>
    normalized.includes(normalizeText(item.name)) ||
    item.keywords.some(keyword => normalized.includes(normalizeText(keyword)))
  )

  if (profile) return profile
  if (includesAny(normalized, CREATOR_FALLBACK_TRIGGERS)) return CREATOR_PROFILE
  return null
}

const FaceScene = dynamic<FaceSceneProps>(
  () => import('@/components/canvas/FaceScene').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="text-cyan-500 font-mono text-xs">INICIALIZANDO VISÃO...</div> }
)


export default function AtendenteInterface() {
  // --- 1. ESTADOS (Estrutura de Dados) ---
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expression, setExpression] = useState<Expression>('neutral')
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visionReport, setVisionReport] = useState('')
  const [, setChatHistory] = useState<ChatMessage[]>([])
  const chatHistoryRef = useRef<ChatMessage[]>([])
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

  const appendChatMessage = useCallback((message: ChatMessage) => {
    const next = [...chatHistoryRef.current, message]
    chatHistoryRef.current = next
    setChatHistory(next)
  }, [])

  const closeProfile = useCallback(() => setActiveProfile(null), [])

  const showProfileMention = useCallback((text: string) => {
    const profile = findMentionedProfile(text)
    if (profile) setActiveProfile(profile)
  }, [])

  const handleVisionDescription = useCallback((text: string) => {
    setLoading(false)
    playSFX('end')
    setVisionReport(text || '')
    if (text) {
      setExpression(analyzeSentiment(text))
      showProfileMention(text)
      appendChatMessage({ role: 'assistant', content: text })
      speak(text)
    }
  }, [speak, playSFX, showProfileMention, appendChatMessage])

  const { faceCoords, triggerDescription, visionStatus, recognizedFace } = useVision({
    onSpeak: handleVisionDescription,
    videoRef
  })

  useEffect(() => {
    if (recognizedFace) showProfileMention(recognizedFace)
  }, [recognizedFace, showProfileMention])

  const lastSpeakEndTime = useRef(0)

  // Processamento de Mensagens
  const processMessage = useCallback(async (
    message: string,
    isVoice: boolean = false,
    options?: { allowWhileSpeaking?: boolean }
  ) => {
    const trimmedMessage = message.trim()
    const normalizedMessage = normalizeText(trimmedMessage)
    const allowWhileSpeaking = options?.allowWhileSpeaking ?? false

    if (!trimmedMessage) return

    if (isVoice && includesAny(normalizedMessage, STOP_VOICE_PHRASES)) {
      stop()
      stopListeningRef.current()
      setLoading(false)
      setInput('')
      return
    }

    // PROTEÇÃO ANTI-ECO: Apenas para voz, ignoramos se o Zord estiver falando ou se acabou de falar.
    const now = Date.now()
    const timeSinceLastSpeak = now - lastSpeakEndTime.current
    const isRecentlySpoken = isVoice && timeSinceLastSpeak < 1200

    if (loading || (!allowWhileSpeaking && isVoice && isSpeaking) || isRecentlySpoken) {
      if (isRecentlySpoken || (isVoice && isSpeaking)) {
        console.log(`>>> ZORD: Bloqueio de Eco [Voz]. Speaking: ${isSpeaking}, Recent: ${isRecentlySpoken}`)
      }
      return
    }

    playSFX('process')

    const previousHistory = chatHistoryRef.current
    appendChatMessage({ role: 'user', content: trimmedMessage })
    showProfileMention(trimmedMessage)

    // Controle de Expressão Manual via Gatilho
    if (includesAny(normalizedMessage, ['sorri', 'feliz', 'alegre'])) {
      setExpression('smile')
    } else if (includesAny(normalizedMessage, ['triste', 'baixo', 'chorar'])) {
      setExpression('sad')
    } else if (includesAny(normalizedMessage, ['normal', 'neutro'])) {
      setExpression('neutral')
    }

    // Gatilho de Visão
    if (includesAny(normalizedMessage, VISION_TRIGGERS)) {
      setLoading(true)
      speak("Iniciando varredura óptica.")
      const started = triggerDescription()
      if (!started) {
        setLoading(false)
        speak("Sistemas visuais offline.")
      }
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
          message: trimmedMessage,
          history: previousHistory,
          visionContext: visionPayload,
        }),
      })
      const data = await res.json() as { text?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Falha no provedor de chat')
      }

      const responseText = data.text?.trim()
      if (responseText) {
        // Autosentimento: A IA decide a cara que vai fazer
        setExpression(analyzeSentiment(responseText))
        showProfileMention(responseText)
        appendChatMessage({ role: 'assistant', content: responseText })
        speak(responseText)
      }
    } catch (err) {
      console.error("Erro neural:", err)
    } finally {
      setLoading(false)
      setInput('')
    }
  }, [loading, isSpeaking, speak, stop, triggerDescription, playSFX, visionReport, recognizedFace, visionStatus, showProfileMention, appendChatMessage])

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
    const clearListenCooldown = () => {
      if (listenCooldown.current) {
        clearTimeout(listenCooldown.current)
        listenCooldown.current = null
      }
    }

    const scheduleListening = (delay: number) => {
      clearListenCooldown()
      listenCooldown.current = setTimeout(() => {
        listenCooldown.current = null
        if (micEnabled && !isSpeaking && !loading && !isListening) {
          startListening()
        }
      }, delay)
    }

    if (!micEnabled) {
      stopListening()
      clearListenCooldown()
      lastIsSpeaking.current = isSpeaking
      return
    }

    if (!lastIsSpeaking.current && isSpeaking) {
      lastSpeakEndTime.current = 0
      stopListening()
      clearListenCooldown()
    } else if (lastIsSpeaking.current && !isSpeaking && !loading) {
      lastSpeakEndTime.current = Date.now()
      scheduleListening(450)
    } else if (!isSpeaking && !loading && !isListening && !listenCooldown.current) {
      scheduleListening(150)
    }

    lastIsSpeaking.current = isSpeaking
    return clearListenCooldown
  }, [micEnabled, isSpeaking, loading, isListening, startListening, stopListening])

  const handleMicAction = () => {
    unlockAudio()
    setMicEnabled(true)
    // DUPLEX: Se eu clicar para falar e ele estiver falando, ele cala a boca na hora
    if (isSpeaking) {
      stop()
      window.setTimeout(startListening, 100)
    } else {
      startListening()
    }
    playSFX('beep')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    processMessage(input, false)
  }

  // --- 3. COMPOSIÇÃO (Designer) ---
  return (
    <main className="h-screen w-full bg-black overflow-hidden flex items-center justify-center relative">
      <video ref={videoRef} autoPlay playsInline className="hidden" />

      {activeProfile && (
        <ProfileCard profile={activeProfile} onClose={closeProfile} />
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
