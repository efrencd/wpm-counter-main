import { useCallback, useMemo, useRef, useState } from 'react';

type BrowserSpeechRecognition = typeof window.SpeechRecognition;

export interface SpeechDebugEvent {
  timestamp: string;
  resultIndex: number;
  finalChunk: string;
  interimChunk: string;
  combinedTranscript: string;
  resultsLength: number;
}

interface UseSpeechRecognitionResult {
  supported: boolean;
  transcript: string;
  listening: boolean;
  error: string | null;
  debugEvents: SpeechDebugEvent[];
  finalTranscript: string;
  interimTranscript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(lang = 'es-ES', debug = false): UseSpeechRecognitionResult {
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugEvents, setDebugEvents] = useState<SpeechDebugEvent[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

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
      let finalChunk = '';
      const interimParts: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const piece = result[0]?.transcript?.trim() ?? '';
        if (!piece) continue;

        if (result.isFinal) {
          finalChunk = `${finalChunk} ${piece}`.trim();
        } else {
          interimParts.push(piece);
        }
      }

      if (finalChunk) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalChunk}`.trim();
        setFinalTranscript(finalTranscriptRef.current);
      }

      const interim = interimParts.join(' ').trim();
      setInterimTranscript(interim);

      const combined = `${finalTranscriptRef.current} ${interim}`.trim();
      setTranscript(combined);

      if (debug) {
        const debugEvent: SpeechDebugEvent = {
          timestamp: new Date().toISOString(),
          resultIndex: event.resultIndex,
          finalChunk,
          interimChunk: interim,
          combinedTranscript: combined,
          resultsLength: event.results.length,
        };

        setDebugEvents((previous) => [...previous.slice(-49), debugEvent]);
      }
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
    finalTranscriptRef.current = '';
    setTranscript('');
    setFinalTranscript('');
    setInterimTranscript('');
    setDebugEvents([]);
    setError(null);
  }, []);

  return { supported, transcript, listening, error, debugEvents, finalTranscript, interimTranscript, start, stop, reset };
}
