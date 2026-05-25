'use client'

import { Mic, Square } from 'lucide-react'

interface ChatControlsProps {
    input: string;
    setInput: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    startListening: () => void;
    onStop: () => void;
    isListening: boolean;
    inputLevel: number;
    loading: boolean;
    isSpeaking: boolean;
}

export const ChatControls = ({
    input,
    setInput,
    onSubmit,
    startListening,
    onStop,
    isListening,
    inputLevel,
    loading,
    isSpeaking
}: ChatControlsProps) => {
    const clampedInputLevel = Math.max(0, Math.min(1, inputLevel))

    return (
        <footer className="w-full max-w-lg mt-12 z-20 px-4">
            <form
                onSubmit={onSubmit}
                className="bg-neutral-900/40 border border-white/[0.05] p-1.5 rounded-xl transition-all focus-within:border-cyan-500/20"
            >
                <div className="flex items-center gap-4 px-4 py-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isListening ? "Fale agora..." : "Escreva ou fale..."}
                        className="flex-1 bg-transparent text-neutral-200 outline-none placeholder:text-neutral-400 text-xs font-light tracking-widest uppercase"
                    />

                    {isSpeaking && (
                        <button
                            type="button"
                            onClick={onStop}
                            className="text-red-500 hover:text-red-400 transition-all duration-300 flex items-center gap-2 group"
                            title="Parar fala"
                        >
                            <Square size={12} fill="currentColor" strokeWidth={0} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-bold tracking-tighter uppercase hidden sm:block">Parar</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={startListening}
                        disabled={loading}
                        title={isSpeaking ? 'Interromper e falar' : 'Falar'}
                        className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ${isListening ? 'text-red-500 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'text-neutral-100 hover:text-cyan-400 group'}`}
                    >
                        {/* Pulso constante (Ciano quando parado, Vermelho quando ouvindo) */}
                        <span className={`absolute inset-0 rounded-full transition-colors duration-500 animate-[ping_3s_linear_infinite] ${isListening ? 'bg-red-500/20' : 'bg-cyan-500/10'}`} />

                        {/* Pulso secundário apenas quando ouvindo */}
                        {isListening && (
                            <span
                                className="absolute inset-2 rounded-full bg-red-500/30 transition-transform duration-100"
                                style={{ transform: `scale(${1 + clampedInputLevel * 0.85})`, opacity: 0.35 + clampedInputLevel * 0.55 }}
                            />
                        )}

                        <Mic
                            size={20}
                            strokeWidth={1.5}
                            className={`relative z-10 transition-transform ${isListening ? '' : 'group-hover:scale-110'}`}
                            style={isListening ? { transform: `scale(${1 + clampedInputLevel * 0.28})` } : undefined}
                        />
                    </button>
                </div>
            </form>
        </footer>
    );
};
