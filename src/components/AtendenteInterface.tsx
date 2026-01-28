'use client'

import { Vortex } from "@/components/ui/vortex"
import { Suspense, useState, useRef } from 'react'
import { useVoice } from '@/hooks/useVoice'
import dynamic from 'next/dynamic'

const FaceScene = dynamic(() => import('@/components/canvas/FaceScene'), { ssr: false })

export default function AtendenteInterface() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false) // Estado para saber se está ouvindo
  const { speak, isSpeaking } = useVoice()

  // Função unificada para processar a mensagem
  const processMessage = async (message: string) => {
    if (!message.trim() || loading || isSpeaking) return
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    processMessage(input)
  }

  // LÓGICA DE AUDIÇÃO
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Navegador sem suporte a voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      processMessage(transcript); // Envia o que ouviu direto para o Groq
    };

    recognition.start();
  }

  return (
    <main className="h-screen w-full bg-black overflow-hidden flex items-center justify-center">
      <Vortex
        backgroundColor="black"
        rangeY={800}
        particleCount={300}
        baseSpeed={0.2}
        baseHue={0}
        containerClassName="bg-black"
        className="flex items-center justify-center flex-col w-full h-full"
      >
        <header className="absolute top-12 z-20">
          <div className="bg-neutral-900/50 backdrop-blur-2xl border border-white/5 px-6 py-2 rounded-full flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                isSpeaking ? 'bg-white shadow-[0_0_8px_#fff]' : 
                isListening ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-neutral-700'
              }`} />
            <span className="text-[9px] text-neutral-500 font-mono tracking-[0.4em] uppercase">
              {isSpeaking ? 'Cícero Falando' : isListening ? 'Cícero Ouvindo' : 'Sistema Standby'}
            </span>
          </div>
        </header>

        <div className="relative w-full max-w-[600px] aspect-square z-10">
          <div className={`absolute inset-0 bg-white/5 rounded-full blur-[120px] transition-opacity duration-1000 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`} />

          <div className="relative w-full h-full rounded-full border border-white/[0.03] bg-neutral-950/20 backdrop-blur-md overflow-hidden shadow-2xl">
            <Suspense fallback={null}>
              <FaceScene isSpeaking={isSpeaking} />
            </Suspense>
          </div>
        </div>

        <footer className="w-full max-w-lg mt-12 z-20">
          <form onSubmit={handleFormSubmit} className="bg-neutral-900/40 border border-white/[0.05] p-1.5 rounded-xl transition-all focus-within:border-white/20">
            <div className="flex items-center gap-4 px-4 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Ouvindo atentamente..." : "Comando silencioso..."}
                className="flex-1 bg-transparent text-neutral-400 outline-none placeholder:text-neutral-800 text-xs font-light tracking-widest uppercase"
              />
              
              {/* BOTÃO DE MICROFONE */}
              <button
                type="button"
                onClick={startListening}
                disabled={loading || isSpeaking}
                className={`transition-all duration-300 ${
                  isListening ? 'text-white scale-125' : 'text-neutral-700 hover:text-neutral-400'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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