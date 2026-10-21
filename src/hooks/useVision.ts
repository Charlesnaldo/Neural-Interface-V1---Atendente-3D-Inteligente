import { useState, useEffect, useRef, useCallback } from 'react'

import { createClient } from '@/lib/supabase/client'

interface UseVisionProps {
  userId: string
  enabled?: boolean
  onSpeak: (text: string) => void
  videoRef: React.RefObject<HTMLVideoElement | null>
}

type VisionStatus = 'connecting' | 'online' | 'offline'
export type SavedFace = { id: string; name: string; photo: string; created_at: string; last_seen: string }
export type TrackedFace = { id: number; x: number; y: number; width: number; height: number }

interface VisionTrackingPayload {
  type?: 'tracking'
  x?: number
  y?: number
  detected?: boolean
  faces?: TrackedFace[]
}

interface VisionDescriptionPayload {
  type?: 'description'
  text?: string
  recognized?: string | null
}

export function useVision({ onSpeak, videoRef, enabled = false, userId }: UseVisionProps) {
  const [faceCoords, setFaceCoords] = useState({ x: 0.5, y: 0.5 })
  const [trackedFaces, setTrackedFaces] = useState<TrackedFace[]>([])
  const [isVisionLoading, setIsVisionLoading] = useState(false)
  const [recognizedFace, setRecognizedFace] = useState<string | null>(null)
  const [visionStatus, setVisionStatus] = useState<VisionStatus>('connecting')
  const [faces, setFaces] = useState<SavedFace[]>([])
  const [faceError, setFaceError] = useState('')
  const [recognitionAvailable, setRecognitionAvailable] = useState(false)
  const [autoCapture, setAutoCapture] = useState(false)
  const autoCaptureRef = useRef(false)
  const recognitionRef = useRef(false)
  useEffect(() => { autoCaptureRef.current = autoCapture }, [autoCapture])

  const socketRef = useRef<WebSocket | null>(null)
  const orbitalCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const onSpeakRef = useRef(onSpeak)
  const cameraReadyRef = useRef(false)
  const connectedRef = useRef(false)

  useEffect(() => {
    onSpeakRef.current = onSpeak
  }, [onSpeak])

  const setOfflineState = useCallback(() => {
    setVisionStatus('offline')
    setRecognizedFace(null)
    setIsVisionLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cameraStream: MediaStream | null = null
    let attachedVideo: HTMLVideoElement | null = null
    let disposed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempts = 0
    let greeted = false
    connectedRef.current = false

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 } })
      .then(stream => {
        if (disposed) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        cameraStream = stream
        cameraReadyRef.current = true
        if (videoRef.current) {
          attachedVideo = videoRef.current
          attachedVideo.srcObject = stream
        }
        if (connectedRef.current) {
          setVisionStatus('online')
        }
      })
      .catch(err => {
        cameraReadyRef.current = false
        setFaceError('Não foi possível acessar a câmera. Confira a permissão do navegador e tente novamente.')
        console.error('Erro na camera:', err)
        setOfflineState()
      })

    if (!orbitalCanvasRef.current) {
      orbitalCanvasRef.current = document.createElement('canvas')
      orbitalCanvasRef.current.width = 320
      orbitalCanvasRef.current.height = 240
    }

    if (!scanCanvasRef.current) {
      scanCanvasRef.current = document.createElement('canvas')
      scanCanvasRef.current.width = 640
      scanCanvasRef.current.height = 480
    }

    const local = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    const wsUrl = process.env.NEXT_PUBLIC_VISION_WS_URL || (local ? 'ws://localhost:8000/ws/vision' : `wss://${window.location.host}/ws/vision`)

    const connect = () => { try {
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onopen = async () => {
        if (disposed) return
        try {
          if (!userId) {
            socket.send(JSON.stringify({ action: 'track_only' }))
            return
          }
          const { data: { session }, error } = await createClient().auth.getSession()
          if (disposed || socket.readyState !== WebSocket.OPEN) return
          if (error || !session || session.user.id !== userId) {
            setFaceError('Entre novamente para acessar seus rostos.')
            socket.close(1008)
            return
          }
          socket.send(JSON.stringify({ action: 'authenticate', token: session.access_token }))
          socket.send(JSON.stringify({ action: 'list_faces' }))
        } catch {
          setFaceError('Não foi possível autenticar a visão.')
          socket.close()
        }
      }

      socket.onmessage = (event) => {
        if (disposed) return
        try {
          const payload = JSON.parse(event.data)
          if (payload.type === 'authenticated') {
            connectedRef.current = true
            if (cameraReadyRef.current) setVisionStatus('online')
            return
          }
          if (payload.type === 'faces') {
            connectedRef.current = true
            reconnectAttempts = 0
            if (cameraReadyRef.current) setVisionStatus('online')
            setFaces(payload.faces)
            setRecognitionAvailable(Boolean(payload.recognitionAvailable))
            recognitionRef.current = Boolean(payload.recognitionAvailable)
            setFaceError('')
            return
          }
          if (payload.type === 'face_error') {
            setFaceError(payload.error || 'Falha ao salvar rosto.')
            return
          }
          if (payload.type === 'face_result') {
            setRecognizedFace(payload.recognized ?? null)
            return
          }
          const data: VisionTrackingPayload & VisionDescriptionPayload = payload

          if (data.type === 'tracking' || data.detected) {
            setTrackedFaces(data.faces ?? [])
            if (!userId && !greeted && data.faces?.length) {
              greeted = true
              onSpeakRef.current('Olá! Como prefere ser chamado?')
            }
            if (typeof data.x === 'number' && typeof data.y === 'number') {
              setFaceCoords({ x: data.x, y: data.y })
            }
            return
          }

          if (data.type === 'description') {
            setIsVisionLoading(false)
            if (data.text) onSpeakRef.current(data.text)
            setRecognizedFace(data.recognized ?? null)
          }
        } catch (err) {
          console.error('Erro no processamento da mensagem do socket:', err)
          setIsVisionLoading(false)
        }
      }

      socket.onerror = (err) => {
        if (disposed) return
        console.error('Erro no socket de visao:', err)
        setOfflineState()
      }

      socket.onclose = () => {
        if (disposed) return
        connectedRef.current = false
        recognitionRef.current = false
        setOfflineState()
        if (reconnectAttempts < 8) {
          reconnectAttempts += 1
          reconnectTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** reconnectAttempts))
        } else setFaceError('Serviço de visão indisponível. Desligue e ligue a câmera para tentar novamente.')
      }
    } catch (error) {
      console.error('Falha ao inicializar WebSocket:', error)
      window.setTimeout(setOfflineState, 0)
    } }
    connect()

    let lastCapture = 0
    const interval = window.setInterval(() => {
      const socket = socketRef.current
      const video = videoRef.current
      const orbitalCanvas = orbitalCanvasRef.current
      if (!connectedRef.current || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !orbitalCanvas || socket?.readyState !== WebSocket.OPEN) {
        return
      }

      const ctx = orbitalCanvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      ctx.drawImage(video, 0, 0, 320, 240)
      socket.send(orbitalCanvas.toDataURL('image/jpeg', 0.4))
      if (recognitionRef.current && Date.now() - lastCapture > 5000 && scanCanvasRef.current) {
        lastCapture = Date.now()
        const scan = scanCanvasRef.current
        const context = scan.getContext('2d')
        if (context) {
          context.drawImage(video, 0, 0, 640, 480)
          socket.send(JSON.stringify({ action: 'observe_face', register: autoCaptureRef.current, image: scan.toDataURL('image/jpeg', 0.8) }))
        }
      }
    }, 200)

    return () => {
      disposed = true
      clearTimeout(reconnectTimer)
      connectedRef.current = false
      window.clearInterval(interval)
      socketRef.current?.close()
      cameraReadyRef.current = false
      cameraStream?.getTracks().forEach(track => track.stop())
      if (attachedVideo) {
        attachedVideo.srcObject = null
      }
    }
  }, [enabled, setOfflineState, videoRef, userId])

  const faceCommand = useCallback((action: string, values: Record<string, string> = {}) => {
    const socket = socketRef.current
    if (!enabled || !connectedRef.current || socket?.readyState !== WebSocket.OPEN) {
      setFaceError('Ligue a câmera e aguarde a conexão com o serviço de visão.')
      return
    }
    setFaceError('')
    if (action === 'capture_face') {
      const video = videoRef.current
      const canvas = scanCanvasRef.current
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !canvas) {
        setFaceError('Aguarde a câmera ficar pronta.')
        return
      }
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(video, 0, 0, 640, 480)
      values = { ...values, image: canvas.toDataURL('image/jpeg', 0.85) }
    }
    socket.send(JSON.stringify({ action, ...values }))
  }, [enabled, videoRef])

  const triggerDescription = useCallback(() => {
    if (!userId && connectedRef.current) {
      onSpeakRef.current(`Estou acompanhando ${trackedFaces.length} rosto(s) no enquadramento. Você pode me dizer como prefere ser chamado.`)
      return true
    }
    const socket = socketRef.current
    const video = videoRef.current
    const scanCanvas = scanCanvasRef.current

    if (video && scanCanvas && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && socket?.readyState === WebSocket.OPEN) {
      setIsVisionLoading(true)

      const ctx = scanCanvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        setIsVisionLoading(false)
        return false
      }

      ctx.drawImage(video, 0, 0, 640, 480)
      const fullFrame = scanCanvas.toDataURL('image/jpeg', 0.5)
      socket.send(`DESCRIBE:${fullFrame}`)
      return true
    }

    console.warn('Visao indisponivel para varredura.')
    setIsVisionLoading(false)
    return false
  }, [videoRef, userId, trackedFaces.length])

  return {
    trackedFaces: enabled ? trackedFaces : [],
    faces, faceError, recognitionAvailable, autoCapture, setAutoCapture, faceCommand,
    faceCoords,
    isVisionLoading,
    triggerDescription,
    visionStatus: enabled ? visionStatus : 'offline',
    recognizedFace: enabled ? recognizedFace : null,
  }
}
