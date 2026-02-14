import { useState, useEffect, useRef, useCallback } from 'react';

export const useSpeechToText = (onFinalTranscript: (text: string) => void, isSpeaking: boolean) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false); // Desejo do usuário (ligar/desligar)
  const isActiveRef = useRef(false);    // Estado real do hardware (ocupado/livre)
  const isSpeakingRef = useRef(isSpeaking);

  // Memoize the transcript handler to avoid unnecessary effect triggers
  const handleResult = useCallback((event: any) => {
    if (isSpeakingRef.current) return;
    const transcript = event.results[event.results.length - 1][0].transcript;
    onFinalTranscript(transcript);
  }, [onFinalTranscript]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition && !recognitionRef.current) {
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = false;
      recog.lang = 'pt-BR';

      recog.onstart = () => {
        console.log(">>> VOZ: Microfone Ativo.");
        isActiveRef.current = true;
      };

      recog.onresult = handleResult;

      recog.onerror = (event: any) => {
        // Erro de rede não reseta o desejo de ouvir (isListeningRef)
        if (event.error === 'network') {
          console.warn(">>> VOZ: Falha de rede. Tentando recuperar...");
          return;
        }

        if (event.error === 'no-speech') return;

        console.error(">>> VOZ: Erro:", event.error);
        setIsListening(false);
        isListeningRef.current = false;
      };

      recog.onend = () => {
        console.log(">>> VOZ: Microfone Inativo.");
        isActiveRef.current = false;

        // AUTO-RESTART: Se o usuário quer ouvir (isListeningRef), mas parou (onend)
        if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current && !isActiveRef.current) {
              try {
                recognitionRef.current?.start();
              } catch (e) {
                // Silenciamos o erro de já iniciado aqui pois isActiveRef deve prevenir
              }
            }
          }, 400); // Delay menor para recuperação rápida
        }
      };

      recognitionRef.current = recog;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [handleResult]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const startListening = useCallback(() => {
    if (isSpeaking) return;
    if (recognitionRef.current) {
      isListeningRef.current = true;
      setIsListening(true);

      // Só inicia o hardware se ele não estiver ocupado
      if (!isActiveRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn(">>> VOZ: Tentativa de start ignorada (já ativo).");
        }
      }
    }
  }, [isSpeaking]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false; // Usuário não quer mais ouvir
    setIsListening(false);

    if (recognitionRef.current && isActiveRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        console.error(">>> VOZ: Erro ao parar:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (isSpeaking) {
      stopListening();
    }
  }, [isSpeaking, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      if (isSpeaking) return;
      startListening();
    }
  }, [isSpeaking, startListening, stopListening]);

  return { isListening, toggleListening, startListening, stopListening };
};
