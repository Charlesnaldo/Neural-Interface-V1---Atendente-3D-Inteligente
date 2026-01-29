'use client'

import { Vortex } from "@/components/ui/vortex"
import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { useVoice } from '@/hooks/useVoice'
import dynamic from 'next/dynamic'

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
  // --- ESTADOS ---
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [faceCoords, setFaceCoords] = useState({ x: 0.5, y: 0.5 })
  
  // Extraímos unlockAudio para permitir som no iOS
  const { speak, isSpeaking, unlockAudio } = useVoice()
  const videoRef = useRef<HTMLVideoElement>(null)
  const socketRef = useRef<WebSocket | null>(null)

  // --- 1. LÓGICA DE VISÃO (WEBSOCKET + WEBCAM) ---
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch(err => console.error("Erro na câmera:", err));

    // Altere para o seu IP ou domínio de produção se necessário
    socketRef.current = new WebSocket("ws://localhost:8000/ws/vision");

    socketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "tracking" || data.detected) {
          setFaceCoords({ x: data.x, y: data.y });
        } 
        else if (data.type === "description") {
          setLoading(false);
          if (data.text) speak(data.text);
        }
      } catch (err) {
        console.error("Erro no socket:", err);
      }
    };

    const interval = setInterval(() => {
      if (videoRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(videoRef.current, 0, 0, 160, 120);
        socketRef.current.send(canvas.toDataURL("image/jpeg", 0.4));
      }
    }, 200);

    return () => { clearInterval(interval); socketRef.current?.close(); };
  }, [speak]);

  // --- 2. LÓGICA DE PROCESSAMENTO ---
  const processMessage = async (message: string) => {
    const lowerMessage = message.toLowerCase();
    
    // REGRA: Só responde se chamarem pelo nome "Zord"
    if (!lowerMessage.includes("zord")) return;

    // Limpa o nome do comando para a IA não se confundir
    const cleanMessage = lowerMessage.replace("zord", "").trim();

    if (cleanMessage === "") {
      speak("Sim, estou ouvindo. Em que posso ajudar?");
      return;
    }

    if (cleanMessage.includes("descreva o que vê") || cleanMessage.includes("escanear ambiente")) {
      handleVisionDescription();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cleanMessage }),
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

  const handleVisionDescription = () => {
    if (videoRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
      setLoading(true);
      speak("Iniciando varredura óptica."); 

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(videoRef.current, 0, 0, 640, 480);
      
      const fullFrame = canvas.toDataURL("image/jpeg", 0.5);
      socketRef.current.send(`DESCRIBE:${fullFrame}`);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Navegador sem suporte a voz.");

    // Desbloqueio crucial para iOS (iPhone)
    unlockAudio();

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      processMessage(transcript);
    };
    recognition.start();
  }

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
        <header className="absolute top-12 z-20">
          <div className="bg-neutral-900/50 backdrop-blur-2xl border border-white/5 px-6 py-2 rounded-full flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                isSpeaking ? 'bg-cyan-500 shadow-[0_0_8px_cyan]' : 
                isListening ? 'bg-red-500 shadow-[0_0_8px_red]' : 
                loading ? 'bg-yellow-500 animate-pulse' : 'bg-neutral-700'
              }`} />
            <span className="text-[9px] text-neutral-500 font-mono tracking-[0.4em] uppercase">
              {isSpeaking ? 'Zord Transmitindo' : isListening ? 'Zord Ouvindo' : loading ? 'Zord Processando' : 'Zord em Standby'}
            </span>
          </div>
        </header>

        <div className="relative w-full max-w-[500px] aspect-square z-10">
          <div className={`absolute inset-0 bg-cyan-500/5 rounded-full blur-[120px] transition-opacity duration-1000 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`} />
          <div className="relative w-full h-full rounded-full border border-white/[0.03] bg-neutral-950/20 backdrop-blur-md overflow-hidden shadow-2xl">
            <Suspense fallback={null}>
              <FaceScene isSpeaking={isSpeaking} faceCoords={faceCoords} />
            </Suspense>
          </div>
        </div>

        <footer className="w-full max-w-lg mt-12 z-20 px-4">
          <form 
            onSubmit={(e) => { e.preventDefault(); processMessage(input); }} 
            className="bg-neutral-900/40 border border-white/[0.05] p-1.5 rounded-xl transition-all focus-within:border-cyan-500/20"
          >
            <div className="flex items-center gap-4 px-4 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Aguardando comando..." : "Chame pelo 'Zord'..."}
                className="flex-1 bg-transparent text-neutral-300 outline-none placeholder:text-neutral-700 text-xs font-light tracking-widest uppercase"
              />
              
              <button
                type="button"
                onClick={startListening}
                disabled={loading || isSpeaking}
                className={`transition-all duration-300 ${
                  isListening ? 'text-red-500 scale-125' : 'text-neutral-700 hover:text-neutral-400'
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
              </button>
            </div>
          </form>
        </footer>
      </Vortex>
    </main>
  )
}