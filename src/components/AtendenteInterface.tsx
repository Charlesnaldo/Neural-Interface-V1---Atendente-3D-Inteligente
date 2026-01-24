'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'
import { useVoice } from '@/hooks/useVoice'

const FaceScene = dynamic(() => import('@/components/canvas/FaceScene'), { 
  ssr: false,
})

export default function AtendenteInterface() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { speak, isSpeaking } = useVoice()

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input // Salva o input antes de limpar
    setLoading(true)
    setInput('') // Limpa o campo imediatamente para melhor UX

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })
      
      const data = await res.json() // Lemos o JSON apenas UMA VEZ aqui

      if (!res.ok) {
        throw new Error(data.error || 'Erro na requisição');
      }

      // 2. SUCESSO! Agora fazemos o Alex falar o texto retornado
      if (data.text) {
        speak(data.text) // O hook useVoice deve gerenciar o isSpeaking internamente
      }

    } catch (err: any) {
      console.error("Erro na comunicação com Alex:", err)
      // Feedback visual simples em caso de erro
      speak("Desculpe, tive um erro no meu sistema neural.") 
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative h-screen w-full bg-neutral-950 overflow-hidden">
      {/* Camada 3D */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={
          <div className="h-full w-full flex items-center justify-center text-white font-mono uppercase tracking-widest animate-pulse">
            Iniciando Sistemas Neurais...
          </div>
        }>
          <FaceScene isSpeaking={isSpeaking} />
        </Suspense>
      </div>

      {/* Camada de UI */}
      <div className="relative z-10 flex flex-col justify-between h-full p-8 pointer-events-none">
        <header className="pointer-events-auto">
          <div className="flex items-center gap-3">
            {/* Indicador de status mais "tech" */}
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px] transition-colors duration-500 ${
              isSpeaking ? 'bg-blue-500 shadow-blue-500 animate-pulse' : 'bg-green-500 shadow-green-500'
            }`} />
            <h1 className="text-white/50 text-xs font-mono tracking-[0.3em] uppercase">
              {isSpeaking ? 'Alex: Transmitindo Voz' : 'Alex: Standby'}
            </h1>
          </div>
        </header>

        {/* Rodapé com Input */}
        <footer className="w-full max-w-xl mx-auto pointer-events-auto mb-4">
          <form 
            onSubmit={handleSendMessage}
            className="bg-black/40 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl transition-all focus-within:border-white/30 group"
          >
            <div className="flex items-center gap-4">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                placeholder={loading ? "ALEX está processando..." : "Envie um comando para o Alex..."} 
                className="flex-1 bg-transparent text-white outline-none placeholder:text-neutral-700 font-light tracking-wide disabled:opacity-50"
              />
              {loading && (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              )}
            </div>
          </form>
         
        </footer>
      </div>
    </main>
  )
}