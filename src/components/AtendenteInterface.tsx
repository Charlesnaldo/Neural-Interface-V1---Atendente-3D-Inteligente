'use client' // Garante que tudo aqui dentro é Client-side

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Movemos o dynamic para cá. Aqui ele NÃO dará erro de Server Component.
const FaceScene = dynamic(() => import('@/components/canvas/FaceScene'), { 
  ssr: false,
})

export default function AtendenteInterface() {
  return (
    <main className="relative h-screen w-full bg-neutral-950 overflow-hidden">
      {/* Camada 3D */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={
          <div className="h-full w-full flex items-center justify-center text-white font-mono uppercase tracking-widest">
            Iniciando Sistemas Neurais...
          </div>
        }>
          <FaceScene />
        </Suspense>
      </div>

      {/* Camada de UI (Tailwind) */}
      <div className="relative z-10 flex flex-col justify-between h-full p-8 pointer-events-none">
        <header className="pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <h1 className="text-white/50 text-sm font-mono tracking-widest">SISTEMA_ATIVO</h1>
          </div>
        </header>

        <footer className="w-full max-w-xl mx-auto pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl">
            <input 
              type="text" 
              placeholder="Digite para interagir..." 
              className="w-full bg-transparent text-white outline-none placeholder:text-neutral-700 px-2"
            />
          </div>
        </footer>
      </div>
    </main>
  )
}