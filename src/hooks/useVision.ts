import { useState, useEffect, useRef, useCallback } from 'react'

interface UseVisionProps {
  onSpeak: (text: string) => void
  videoRef: React.RefObject<HTMLVideoElement | null>
}

type VisionStatus = 'connecting' | 'online' | 'offline'

interface VisionTrackingPayload {
  type?: 'tracking'
  x?: number
  y?: number
  detected?: boolean
}

interface VisionDescriptionPayload {
  type?: 'description'
  text?: string
  recognized?: string | null
}

export function useVision({ onSpeak, videoRef }: UseVisionProps) {
  const [faceCoords, setFaceCoords] = useState({ x: 0.5, y: 0.5 })
  const [isVisionLoading, setIsVisionLoading] = useState(false)
  const [recognizedFace, setRecognizedFace] = useState<string | null>(null)
  const [visionStatus, setVisionStatus] = useState<VisionStatus>('connecting')

  const socketRef = useRef<WebSocket | null>(null)
  const orbitalCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const setOfflineState = useCallback(() => {
    setVisionStatus('offline')
    setRecognizedFace(null)
    setIsVisionLoading(false)
  }, [])

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch(err => console.error('Erro na camera:', err))

    if (!orbitalCanvasRef.current) {
      orbitalCanvasRef.current = document.createElement('canvas')
      orbitalCanvasRef.current.width = 160
      orbitalCanvasRef.current.height = 120
    }

    if (!scanCanvasRef.current) {
      scanCanvasRef.current = document.createElement('canvas')
      scanCanvasRef.current.width = 640
      scanCanvasRef.current.height = 480
    }

    const wsUrl = process.env.NEXT_PUBLIC_VISION_WS_URL || 'ws://localhost:8000/ws/vision'

    try {
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onopen = () => {
        setVisionStatus('online')
      }

      socket.onmessage = (event) => {
        try {
          const data: VisionTrackingPayload & VisionDescriptionPayload = JSON.parse(event.data)

          if (data.type === 'tracking' || data.detected) {
            if (typeof data.x === 'number' && typeof data.y === 'number') {
              setFaceCoords({ x: data.x, y: data.y })
            }
            return
          }

          if (data.type === 'description') {
            setIsVisionLoading(false)
            if (data.text) onSpeak(data.text)
            setRecognizedFace(data.recognized ?? null)
          }
        } catch (err) {
          console.error('Erro no processamento da mensagem do socket:', err)
          setIsVisionLoading(false)
        }
      }

      socket.onerror = (err) => {
        console.error('Erro no socket de visao:', err)
        setOfflineState()
      }

      socket.onclose = () => {
        setOfflineState()
      }
    } catch (error) {
      console.error('Falha ao inicializar WebSocket:', error)
      window.setTimeout(setOfflineState, 0)
    }

    const interval = window.setInterval(() => {
      const socket = socketRef.current
      const video = videoRef.current
      const orbitalCanvas = orbitalCanvasRef.current
      if (!video || !orbitalCanvas || socket?.readyState !== WebSocket.OPEN) {
        return
      }

      const ctx = orbitalCanvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      ctx.drawImage(video, 0, 0, 160, 120)
      socket.send(orbitalCanvas.toDataURL('image/jpeg', 0.4))
    }, 200)

    return () => {
      window.clearInterval(interval)
      socketRef.current?.close()
    }
  }, [onSpeak, setOfflineState, videoRef])

  const triggerDescription = useCallback(() => {
    const socket = socketRef.current
    const video = videoRef.current
    const scanCanvas = scanCanvasRef.current

    if (video && scanCanvas && socket?.readyState === WebSocket.OPEN) {
      setIsVisionLoading(true)
      onSpeak('Iniciando varredura optica.')

      const ctx = scanCanvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      ctx.drawImage(video, 0, 0, 640, 480)
      const fullFrame = scanCanvas.toDataURL('image/jpeg', 0.5)
      socket.send(`DESCRIBE:${fullFrame}`)
      return
    }

    console.warn('Visao indisponivel para varredura.')
    onSpeak('Sistemas visuais offline.')
  }, [onSpeak, videoRef])

  return {
    faceCoords,
    isVisionLoading,
    triggerDescription,
    visionStatus,
    recognizedFace,
  }
}
