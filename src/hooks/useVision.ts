import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVisionProps {
  onSpeak: (text: string) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useVision({ onSpeak, videoRef }: UseVisionProps) {
  const [faceCoords, setFaceCoords] = useState({ x: 0.5, y: 0.5 });
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [recognizedFace, setRecognizedFace] = useState<string | null>(null);
  const [visionStatus, setVisionStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');

  const socketRef = useRef<WebSocket | null>(null);
  const orbitalCanvasRef = useRef<HTMLCanvasElement | null>(null); // Canvas pequeno para tracking contínuo
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);    // Canvas grande para descrição detalhada

  // Inicializa a conexão e o loop de tracking
  useEffect(() => {
    // Inicializa câmera
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => console.error("Erro na câmera:", err));

    // Inicialização única dos canvases
    if (!orbitalCanvasRef.current) {
      orbitalCanvasRef.current = document.createElement('canvas');
      orbitalCanvasRef.current.width = 160;
      orbitalCanvasRef.current.height = 120;
    }

    if (!scanCanvasRef.current) {
      scanCanvasRef.current = document.createElement('canvas');
      scanCanvasRef.current.width = 640;
      scanCanvasRef.current.height = 480;
    }

    const wsUrl = process.env.NEXT_PUBLIC_VISION_WS_URL || "ws://localhost:8000/ws/vision";

    try {
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log("Vision Socket Connected");
        setVisionStatus('online');
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "tracking" || data.detected) {
            setFaceCoords({ x: data.x, y: data.y });
          }
          else if (data.type === "description") {
            setIsVisionLoading(false);
            if (data.text) onSpeak(data.text);
            setRecognizedFace(data.recognized || null);
          }
        } catch (err) {
          console.error("Erro no processamento da mensagem do socket:", err);
          setIsVisionLoading(false);
        }
      };

      socketRef.current.onerror = (err) => {
        console.error("Erro no socket de visão:", err);
        setIsVisionLoading(false);
        setVisionStatus('offline');
        setRecognizedFace(null);
      };

      socketRef.current.onclose = () => {
        setVisionStatus('offline');
        setRecognizedFace(null);
      };
    } catch (e) {
      console.error("Falha ao inicializar WebSocket:", e);
      setVisionStatus('offline');
    }

    // Loop de envio de frames para tracking (Low Res)
    const interval = setInterval(() => {
      if (
        videoRef.current &&
        socketRef.current?.readyState === WebSocket.OPEN &&
        orbitalCanvasRef.current
      ) {
        const ctx = orbitalCanvasRef.current.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 160, 120);
          // Envia JPEG com baixa qualidade para performance
          socketRef.current.send(orbitalCanvasRef.current.toDataURL("image/jpeg", 0.4));
        }
      }
    }, 200);

    return () => {
      clearInterval(interval);
      socketRef.current?.close();
    };
  }, [onSpeak, videoRef]);

  // Função para gatilho manual de descrição (High Res)
  const triggerDescription = useCallback(() => {
    if (
      videoRef.current &&
      socketRef.current?.readyState === WebSocket.OPEN &&
      scanCanvasRef.current
    ) {
      setIsVisionLoading(true);
      onSpeak("Iniciando varredura óptica.");

      const ctx = scanCanvasRef.current.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const fullFrame = scanCanvasRef.current.toDataURL("image/jpeg", 0.5);
        socketRef.current.send(`DESCRIBE:${fullFrame}`);
      }
    } else {
      console.warn("Visão indisponível para varredura.");
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        onSpeak("Sistemas visuais offline.");
      }
    }
  }, [onSpeak, videoRef]);

      return {
    faceCoords,
    isVisionLoading,
    triggerDescription,
    visionStatus,
    recognizedFace
  };
}
