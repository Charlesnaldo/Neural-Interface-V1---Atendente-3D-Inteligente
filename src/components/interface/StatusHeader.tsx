'use client'



//  Gerencia apenas a exibição do status (Ouvindo, Transmitindo, etc).

interface StatusHeaderProps {
    isSpeaking: boolean;
    isListening: boolean;
    loading: boolean;
}

export const StatusHeader = ({ isSpeaking, isListening, loading }: StatusHeaderProps) => {
    return (
        <header className="absolute top-12 z-20">
            <div className="bg-neutral-900/50 backdrop-blur-2xl border border-white/5 px-6 py-2 rounded-full flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isSpeaking ? 'bg-cyan-500 shadow-[0_0_8px_cyan]' :
                    isListening ? 'bg-red-500 shadow-[0_0_8px_red]' :
                        loading ? 'bg-yellow-500 animate-pulse' : 'bg-neutral-700'
                    }`} />
                <span className="text-[9px] text-neutral-300 font-mono tracking-[0.4em] uppercase">
                    {isSpeaking ? 'Transmitindo' : isListening ? 'Ouvindo' : loading ? 'Processando' : 'Standby'}
                </span>
            </div>
        </header>
    );
};
