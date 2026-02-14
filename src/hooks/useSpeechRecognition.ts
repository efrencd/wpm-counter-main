import { useCallback, useMemo, useRef, useState } from 'react';

type BrowserSpeechRecognition = typeof window.SpeechRecognition;

interface UseSpeechRecognitionResult {
  supported: boolean;
  transcript: string;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(lang = 'es-ES'): UseSpeechRecognitionResult {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const Recognition = useMemo(() => {
    return (window.SpeechRecognition || window.webkitSpeechRecognition) as BrowserSpeechRecognition | undefined;
  }, []);

  const supported = Boolean(Recognition);

  const ensureInstance = useCallback(() => {
    if (!Recognition) return null;
    if (recognitionRef.current) return recognitionRef.current;

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const combined = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      setTranscript(combined);
    };

    recognition.onerror = (event) => {
      setError(event.error ?? 'Error de reconocimiento');
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [Recognition, lang]);

  const start = useCallback(() => {
    const recognition = ensureInstance();
    if (!recognition) {
      setError('Este navegador no soporta Web Speech API.');
      return;
    }
    setError(null);
    setListening(true);
    recognition.start();
  }, [ensureInstance]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return { supported, transcript, listening, error, start, stop, reset };
}
