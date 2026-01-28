import { useState, useEffect } from 'react';


// Web Speech API

export const useSpeechToText = (onFinalTranscript: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // Verifica se o navegador suporta Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = false; 
      recog.interimResults = false;
      recog.lang = 'pt-BR'; 

      recog.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onFinalTranscript(transcript);
        setIsListening(false);
      };

      recog.onerror = () => setIsListening(false);
      recog.onend = () => setIsListening(false);

      setRecognition(recog);
    }
  }, [onFinalTranscript]);

  const toggleListening = () => {
    if (isListening) {
      recognition?.stop();
    } else {
      recognition?.start();
      setIsListening(true);
    }
  };

  return { isListening, toggleListening };
};