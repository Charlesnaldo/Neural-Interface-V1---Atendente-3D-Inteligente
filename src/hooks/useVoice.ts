'use client'
import { useState, useCallback, useRef } from 'react'

export const useVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isUnlockedRef = useRef(false)

  // Desbloqueia áudio para navegadores mobile (iOS/Android)
  const unlockAudio = useCallback(() => {
    if (isUnlockedRef.current) return;

    // Buffer silencioso para habilitar o contexto de áudio
    const utterance = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(utterance);

    isUnlockedRef.current = true;
    console.log(">>> ZORD: Sistemas de voz locais desbloqueados.");
  }, []);

  const speak = useCallback((text: string) => {
    if (!text) return;

    // Cancela qualquer fala anterior
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';

    // Tenta encontrar uma voz mais "natural" do sistema (como as vozes Maria ou Google)
    const voices = window.speechSynthesis.getVoices();
    const brVoice = voices.find(v => v.lang.includes('pt-BR') && v.name.includes('Online')) ||
      voices.find(v => v.lang.includes('pt-BR'));

    if (brVoice) utterance.voice = brVoice;

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, unlockAudio }
}