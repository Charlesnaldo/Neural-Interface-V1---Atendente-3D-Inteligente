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
import { AssistantPanel } from './interface/AssistantPanel'
import { FaceRegistry } from './interface/FaceRegistry'
import { VisitorPhotoCapture } from './interface/VisitorPhotoCapture'
import { FaceScanOverlay } from './interface/FaceScanOverlay'
import { emptyStore, personalCommand } from '@/lib/assistant-store'
import { usePersonalStore } from '@/hooks/usePersonalStore'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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
const NEGATIVE_WORDS = ['triste', 'ruim', 'erro', 'falha', 'infelizmente', 'perdão', 'desculpe', 'difícil']
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
  const words = new Set(normalized.match(/[a-z]+/g) ?? [])
  if (NEGATIVE_WORDS.some(word => words.has(normalizeText(word)))) return 'sad'
  if (POSITIVE_WORDS.some(word => words.has(normalizeText(word)))) return 'smile'
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


export default function AtendenteInterface({ userId }: { userId: string }) {
  // --- 1. ESTADOS (Estrutura de Dados) ---
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expression, setExpression] = useState<Expression>('neutral')
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visionReport, setVisionReport] = useState('')
  const { store, storeRef, ready, saving, storageError, commitStore, importLocalData } = usePersonalStore(Boolean(userId))
  const [error, setError] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [facesOpen, setFacesOpen] = useState(false)
  const requestRef = useRef<AbortController | null>(null)
  const [micEnabled, setMicEnabled] = useState(false)
  const stopListeningRef = useRef<() => void>(() => {})

  // --- 2. GESTORES DE LOGICA (Hooks) ---
  const { speak, stop, isSpeaking, unlockAudio, audioMetrics, audioMetricsLiveRef } = useVoice()

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

  useEffect(() => () => requestRef.current?.abort(), [])

  const appendChatMessage = useCallback((message: ChatMessage) => {
    commitStore({ ...storeRef.current, history: [...storeRef.current.history, message].slice(-100) })
  }, [commitStore, storeRef])

  const addPersonalItem = useCallback((kind: 'memory' | 'task', text: string) => {
    const key = kind === 'memory' ? 'memories' : 'tasks'
    commitStore({ ...storeRef.current, [key]: [...storeRef.current[key], { id: crypto.randomUUID(), text: text.slice(0, 1000), done: false }].slice(-100) })
  }, [commitStore, storeRef])

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

  const { faceCoords, trackedFaces, triggerDescription, visionStatus, recognizedFace, faces, faceError, recognitionAvailable, autoCapture, setAutoCapture, faceCommand } = useVision({
    onSpeak: handleVisionDescription,
    videoRef,
    userId,
    enabled: cameraEnabled
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

    if (!trimmedMessage || !ready || requestRef.current) return

    if (isVoice && includesAny(normalizedMessage, STOP_VOICE_PHRASES)) {
      stop()
      stopListeningRef.current()
      setMicEnabled(false)
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

    setError('')
    playSFX('process')

    const previousHistory = storeRef.current.history
    appendChatMessage({ role: 'user', content: trimmedMessage })
    showProfileMention(trimmedMessage)

    const cameraCommand = normalizedMessage.replace(/[.!?]+$/, '').match(/^(?:zord[, ]+)?(acione|acionar|ligue|ligar|ative|ativar|desligue|desligar|desative|desativar) (?:a )?camera$/)
    if (cameraCommand) {
      const enable = !cameraCommand[1].startsWith('des')
      setCameraEnabled(enable)
      setAutoCapture(false)
      setVisionReport('')
      setFacesOpen(enable)
      setPanelOpen(false)
      const answer = enable ? 'Vou solicitar acesso à câmera. Você pode cadastrar rostos no painel.' : 'Câmera desligada.'
      appendChatMessage({ role: 'assistant', content: answer })
      speak(answer)
      setInput('')
      return
    }

    const command = personalCommand(trimmedMessage)
    if (command) {
      addPersonalItem(command.kind, command.text)
      const answer = command.kind === 'memory' ? `Guardei na memória: ${command.text}` : `Tarefa criada: ${command.text}`
      appendChatMessage({ role: 'assistant', content: answer })
      speak(answer)
      setInput('')
      return
    }

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
    const controller = new AbortController()
    requestRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 45000)
    try {
      const visionPayload = {
        description: visionReport || null,
        recognizedFace,
        status: visionStatus,
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedMessage,
          history: previousHistory,
          personalContext: { memories: storeRef.current.memories.map(item => item.text), tasks: storeRef.current.tasks.filter(item => !item.done).map(item => item.text) },
          visionContext: visionPayload,
        }),
      })
      const data = await res.json() as { text?: string; error?: string }
      if (controller.signal.aborted) return
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
      setError(err instanceof Error && err.name === 'AbortError' ? 'Resposta cancelada ou tempo limite excedido. Tente novamente.' : 'Não foi possível conversar agora. Verifique a conexão e tente novamente.')
    } finally {
      window.clearTimeout(timeout)
      requestRef.current = null
      setLoading(false)
      setInput('')
    }
  }, [ready, addPersonalItem, loading, isSpeaking, speak, stop, triggerDescription, playSFX, visionReport, recognizedFace, visionStatus, showProfileMention, appendChatMessage, setAutoCapture, storeRef])

  const { isListening, inputLevel, startListening, stopListening } = useSpeechToText(
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
    if (micEnabled && !isSpeaking) {
      setMicEnabled(false)
      stopListening()
      return
    }
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
      <div className="absolute left-4 top-5 z-50 flex gap-2">
        {userId && <Link href="/admin/photos" className="rounded-xl bg-neutral-950/90 p-2 text-sm text-cyan-200">Fotos autorizadas</Link>}
        {userId ? <>
          <button type="button" aria-expanded={panelOpen} onClick={() => { setPanelOpen(value => !value); setFacesOpen(false) }} className="rounded-xl border border-white/15 bg-neutral-950/90 px-4 py-2 text-sm text-cyan-200">{panelOpen ? 'Fechar painel' : 'Meu assistente'}</button>
          <button type="button" aria-expanded={facesOpen} onClick={() => { setFacesOpen(value => !value); setPanelOpen(false) }} className="rounded-xl border border-white/15 bg-neutral-950/90 px-4 py-2 text-sm text-cyan-200">{facesOpen ? 'Fechar rostos' : 'Rostos'}</button>
        </> : <>
          <button type="button" aria-pressed={cameraEnabled} onClick={() => { unlockAudio(); setCameraEnabled(value => !value) }} className="rounded-xl border border-white/15 bg-neutral-950/90 px-3 py-2 text-sm text-cyan-200">{cameraEnabled ? 'Desligar câmera' : 'Rastrear rostos'}</button>
          <Link href="/admin" className="rounded-xl border border-white/15 bg-neutral-950/90 px-3 py-2 text-sm text-neutral-300">Admin</Link>
        </>}
      </div>
      {!userId && <p className="absolute left-4 top-16 z-30 max-w-60 rounded-lg bg-black/70 p-2 text-xs text-neutral-400">Câmera opcional para rastreamento ao vivo. Fotos são salvas somente após sua autorização separada.</p>}
      {userId && facesOpen && <FaceRegistry faces={faces} online={visionStatus === 'online'} cameraEnabled={cameraEnabled} recognitionAvailable={recognitionAvailable} autoCapture={autoCapture} onAutoCapture={setAutoCapture} onCamera={() => { setCameraEnabled(value => !value); setAutoCapture(false); setVisionReport('') }} command={faceCommand} error={faceError} />}
      {(error || storageError) && !panelOpen && <p role="alert" className="absolute bottom-4 left-4 right-4 z-50 rounded-lg bg-red-950 p-3 text-sm text-red-200">{storageError || error}</p>}
      {panelOpen && <AssistantPanel store={store} ready={ready} saving={saving} onImport={importLocalData} onSignOut={async () => { if (saving) return; requestRef.current?.abort(); stop(); setCameraEnabled(false); setMicEnabled(false); stopListening(); const { error } = await createClient().auth.signOut(); if (error) { setError('Não foi possível sair. Tente novamente.'); return } window.location.assign('/login') }} error={storageError || error} onAdd={addPersonalItem}
        onRemove={(kind, id) => commitStore({ ...storeRef.current, [kind]: storeRef.current[kind].filter(item => item.id !== id) })}
        onToggle={id => commitStore({ ...storeRef.current, tasks: storeRef.current.tasks.map(item => item.id === id ? { ...item, done: !item.done } : item) })}
        onClear={() => { requestRef.current?.abort(); stop(); setMicEnabled(false); stopListening(); commitStore(emptyStore()); setVisionReport(''); setActiveProfile(null) }}
        cameraEnabled={cameraEnabled} onCamera={() => { setCameraEnabled(value => !value); setAutoCapture(false); setVisionReport('') }}
        micEnabled={micEnabled} onMicOff={() => { setMicEnabled(false); stopListening() }} />}
      <div className={cameraEnabled ? 'absolute bottom-24 left-4 z-50 w-56 overflow-hidden rounded-xl border border-cyan-400/40 bg-black sm:w-72' : 'hidden'}>
        <div className="relative aspect-[4/3]">
          <video ref={videoRef} autoPlay playsInline muted aria-label="Rastreamento da câmera" className="h-full w-full object-fill" />
          <FaceScanOverlay faces={trackedFaces} />
        </div>
        <p role="status" className="p-2 text-xs text-cyan-100">{trackedFaces.length} rosto(s) no enquadramento</p>
        {!userId && <p className="px-2 pb-2 text-[11px] text-neutral-400">Sem identificação e sem salvamento automático. Conversa mantida apenas nesta página.</p>}
        {faceError && <p role="alert" className="px-2 pb-2 text-xs text-red-300">{faceError}</p>}
      </div>

      {!userId && <div className="absolute bottom-24 right-4 z-50 max-w-56 rounded-xl bg-neutral-950/95"><VisitorPhotoCapture videoRef={videoRef} faces={trackedFaces} active={cameraEnabled} onSaved={() => { setCameraEnabled(false); setAutoCapture(false); setVisionReport('') }} /></div>}
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
          loading={loading || !ready}
        />
        {visionStatus !== 'online' && (
          <div className="absolute top-6 right-6 z-30 px-3 py-1 rounded-full border border-white/30 bg-neutral-900/70 text-[10px] tracking-[0.3em] uppercase text-orange-400">
            {!cameraEnabled ? 'Câmera desligada' : visionStatus === 'connecting' ? 'Visão carregando...' : 'Visão offline'}
          </div>
        )}
        {recognizedFace && (
          <div className="absolute top-16 right-6 z-30 px-3 py-1 rounded-full border border-cyan-400 bg-neutral-900/70 text-[10px] tracking-[0.3em] uppercase text-cyan-200">
            {`Rosto reconhecido: ${recognizedFace}`}
          </div>
        )}

        <FaceDisplay isSpeaking={isSpeaking}>
          <FaceScene
            isSpeaking={isSpeaking}
            isListening={isListening}
            loading={loading}
            faceCoords={faceCoords}
            expression={expression}
            audioMetrics={audioMetrics}
            audioMetricsLiveRef={audioMetricsLiveRef}
            inputLevel={inputLevel}
          />
        </FaceDisplay>

        <ChatControls
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          startListening={handleMicAction}
          onStop={stop}
          isListening={isListening}
          inputLevel={inputLevel}
          loading={loading}
          isSpeaking={isSpeaking}
        />
      </Vortex>
    </main>
  )
}
