import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function normalizeForMerge(text: string): string[] {
  return tokenize(text).map((token) => token.toLowerCase());
}

function countPrefixMatch(base: string[], probe: string[]): number {
  let matched = 0;
  const max = Math.min(base.length, probe.length);
  while (matched < max && base[matched] === probe[matched]) matched += 1;
  return matched;
}

function mergeByWordOverlap(previousText: string, incomingText: string): string {
  const previous = previousText.trim();
  const incoming = incomingText.trim();

  if (!previous) return incoming;
  if (!incoming) return previous;
  if (previous.endsWith(incoming)) return previous;
  if (incoming.endsWith(previous)) return incoming;

  const previousWords = tokenize(previous);
  const incomingWords = tokenize(incoming);
  const previousNormalized = normalizeForMerge(previous);
  const incomingNormalized = normalizeForMerge(incoming);
  const maxOverlap = Math.min(previousWords.length, incomingWords.length);
  const headSkipWindow = Math.min(3, Math.max(0, incomingWords.length - 1));

  // Chrome Android can prepend one or more stray tokens and then replay a full chunk.
  // This tries to find overlap allowing a small skip at the beginning of incoming.
  for (let headSkip = 0; headSkip <= headSkipWindow; headSkip += 1) {
    const candidate = incomingNormalized.slice(headSkip);
    const candidateWords = incomingWords.slice(headSkip);
    const candidateMaxOverlap = Math.min(previousWords.length, candidateWords.length);

    for (let overlap = candidateMaxOverlap; overlap > 0; overlap -= 1) {
      const previousSlice = previousNormalized.slice(previousNormalized.length - overlap).join(' ');
      const incomingSlice = candidate.slice(0, overlap).join(' ');
      if (previousSlice === incomingSlice) {
        return `${previous} ${candidateWords.slice(overlap).join(' ')}`.trim();
      }
    }
  }

  // Replay detection: incoming repeats the beginning of the session with little/no new tail.
  for (let headSkip = 0; headSkip <= headSkipWindow; headSkip += 1) {
    const candidate = incomingNormalized.slice(headSkip);
    const candidateWords = incomingWords.slice(headSkip);
    if (candidate.length < 12 || previousNormalized.length < 12) continue;

    const prefixMatch = countPrefixMatch(previousNormalized, candidate);
    const candidateCoverage = prefixMatch / candidate.length;
    const previousCoverage = prefixMatch / previousNormalized.length;

    if (candidateCoverage >= 0.8 && previousCoverage >= 0.6) {
      const tail = candidateWords.slice(prefixMatch).join(' ');
      return tail ? `${previous} ${tail}`.trim() : previous;
    }
  }

  return `${previous} ${incoming}`.trim();
}

function normalizeSpeechToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]/gi, '');
}

function collapseRunawayRepeats(text: string, runawayThreshold = 6, maxConsecutive = 3): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  const output: string[] = [];
  let index = 0;

  while (index < tokens.length) {
    const currentNormalized = normalizeSpeechToken(tokens[index]);
    let end = index + 1;

    while (end < tokens.length) {
      const nextNormalized = normalizeSpeechToken(tokens[end]);
      if (!currentNormalized || currentNormalized !== nextNormalized) break;
      end += 1;
    }

    const runLength = end - index;
    if (currentNormalized && runLength >= runawayThreshold) {
      output.push(...tokens.slice(index, index + maxConsecutive));
    } else {
      output.push(...tokens.slice(index, end));
    }

    index = end;
  }

  return output.join(' ');
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
  const shouldKeepListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const restartAttemptsRef = useRef(0);

  const Recognition = useMemo(() => {
    return (window.SpeechRecognition || window.webkitSpeechRecognition) as BrowserSpeechRecognition | undefined;
  }, []);

  const supported = Boolean(Recognition);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const ensureInstance = useCallback(() => {
    if (!Recognition) return null;
    if (recognitionRef.current) return recognitionRef.current;

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = false;
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
        const mergedFinal = mergeByWordOverlap(finalTranscriptRef.current, finalChunk);
        finalTranscriptRef.current = collapseRunawayRepeats(mergedFinal);
        setFinalTranscript(finalTranscriptRef.current);
      }

      const interim = interimParts.join(' ').trim();
      setInterimTranscript(interim);

      const combined = collapseRunawayRepeats(`${finalTranscriptRef.current} ${interim}`.trim());
      setTranscript(combined);
      restartAttemptsRef.current = 0;

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
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        shouldKeepListeningRef.current = false;
        clearRestartTimer();
        setListening(false);
      }
    };

    recognition.onend = () => {
      if (!shouldKeepListeningRef.current) {
        setListening(false);
        return;
      }

      clearRestartTimer();
      const delay = Math.min(1600, 150 * (restartAttemptsRef.current + 1));
      restartAttemptsRef.current += 1;

      restartTimerRef.current = window.setTimeout(() => {
        if (!shouldKeepListeningRef.current) return;
        try {
          recognition.start();
          setListening(true);
        } catch {
          // If engine is not ready yet, onend/onerror will trigger next retry.
        }
      }, delay);
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [Recognition, clearRestartTimer, debug, lang]);

  const start = useCallback(() => {
    const recognition = ensureInstance();
    if (!recognition) {
      setError('Este navegador no soporta Web Speech API.');
      return;
    }
    shouldKeepListeningRef.current = true;
    clearRestartTimer();
    restartAttemptsRef.current = 0;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      // Ignore transient InvalidStateError when start is called too quickly.
      setListening(true);
    }
  }, [clearRestartTimer, ensureInstance]);

  const stop = useCallback(() => {
    shouldKeepListeningRef.current = false;
    clearRestartTimer();
    restartAttemptsRef.current = 0;
    recognitionRef.current?.stop();
    setListening(false);
  }, [clearRestartTimer]);

  const reset = useCallback(() => {
    shouldKeepListeningRef.current = false;
    clearRestartTimer();
    restartAttemptsRef.current = 0;
    finalTranscriptRef.current = '';
    setTranscript('');
    setFinalTranscript('');
    setInterimTranscript('');
    setDebugEvents([]);
    setError(null);
  }, [clearRestartTimer]);

  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      clearRestartTimer();
      recognitionRef.current?.stop();
    };
  }, [clearRestartTimer]);

  return { supported, transcript, listening, error, debugEvents, finalTranscript, interimTranscript, start, stop, reset };
}
