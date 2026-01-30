'use client'

interface ChatControlsProps {
    input: string;
    setInput: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    startListening: () => void;
    onStop: () => void; // Nova prop
    isListening: boolean;
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
    loading,
    isSpeaking
}: ChatControlsProps) => {
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
                        placeholder={isListening ? "Fale agora..." : "Enviar comando..."}
                        className="flex-1 bg-transparent text-neutral-200 outline-none placeholder:text-neutral-400 text-xs font-light tracking-widest uppercase"
                    />

                    {isSpeaking && (
                        <button
                            type="button"
                            onClick={onStop}
                            className="text-red-500 hover:text-red-400 transition-all duration-300 flex items-center gap-2 group"
                            title="Parar fala"
                        >
                            <div className="w-3 h-3 bg-red-500 rounded-sm group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-bold tracking-tighter uppercase hidden sm:block">Parar</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={startListening}
                        disabled={loading || isSpeaking}
                        className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${isListening ? 'text-red-500 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'text-neutral-100 hover:text-cyan-400 group'} ${isSpeaking ? 'opacity-30' : ''}`}
                    >
                        {/* Pulso constante (Ciano quando parado, Vermelho quando ouvindo) */}
                        <span className={`absolute inset-0 rounded-full transition-colors duration-500 animate-[ping_3s_linear_infinite] ${isListening ? 'bg-red-500/20' : 'bg-cyan-500/10'}`} />

                        {/* Pulso secundário apenas quando ouvindo */}
                        {isListening && (
                            <span className="absolute inset-2 rounded-full bg-red-500/30 animate-pulse" />
                        )}

                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`relative z-10 transition-transform ${isListening ? '' : 'group-hover:scale-110'}`}>
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" x2="12" y1="19" y2="22" />

                            {/* Círculo animado interno do SVG */}
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="0.5"
                                className={`opacity-30 ${isListening ? 'animate-[ping_1.5s_linear_infinite]' : 'animate-[pulse_4s_ease-in-out_infinite]'}`}
                            />
                        </svg>
                    </button>
                </div>
            </form>
        </footer>
    );
};
