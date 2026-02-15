import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateWpm, computeAccuracy, normalizeSpanishText, tokenizeWords } from '../../lib/textMetrics';
import { getStudentSession, saveLastResult } from '../../lib/studentSession';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

interface AssignedText {
  id: string;
  title: string;
  content: string;
}

interface ComparedToken {
  raw: string;
  isWord: boolean;
  missed: boolean;
}

function normalizeWord(token: string): string {
  return normalizeSpanishText(token);
}

function buildComparedTokens(referenceText: string, hypothesisText: string): ComparedToken[] {
  const rawTokens = referenceText.split(/\s+/).filter(Boolean);
  const normalizedRawTokens = rawTokens.map(normalizeWord);
  const hypothesisWords = tokenizeWords(hypothesisText);

  const referenceWords: string[] = [];
  const wordPositionByRawToken = new Array<number>(rawTokens.length).fill(-1);

  normalizedRawTokens.forEach((token, rawIndex) => {
    if (!token) return;
    wordPositionByRawToken[rawIndex] = referenceWords.length;
    referenceWords.push(token);
  });

  const rows = referenceWords.length + 1;
  const cols = hypothesisWords.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitutionCost = referenceWords[i - 1] === hypothesisWords[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + substitutionCost,
      );
    }
  }

  const matchedReference = new Array(referenceWords.length).fill(false);
  let i = referenceWords.length;
  let j = hypothesisWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const substitutionCost = referenceWords[i - 1] === hypothesisWords[j - 1] ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + substitutionCost) {
        if (substitutionCost === 0) matchedReference[i - 1] = true;
        i -= 1;
        j -= 1;
        continue;
      }
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      i -= 1;
      continue;
    }

    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      j -= 1;
      continue;
    }

    break;
  }

  return rawTokens.map((raw, rawIndex) => {
    const wordPosition = wordPositionByRawToken[rawIndex];
    const isWord = wordPosition >= 0;
    return {
      raw,
      isWord,
      missed: isWord ? !matchedReference[wordPosition] : false,
    };
  });
}

export default function StudentReadingPage() {
  const speechDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('speechDebug') === '1';
  const navigate = useNavigate();
  const [text, setText] = useState<AssignedText | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [comparedTokens, setComparedTokens] = useState<ComparedToken[]>([]);
  const {
    supported,
    transcript,
    listening,
    error,
    start,
    stop,
    reset,
    debugEvents,
    finalTranscript,
    interimTranscript,
  } = useSpeechRecognition('es-ES', speechDebug);

  const session = useMemo(() => getStudentSession(), []);

  useEffect(() => {
    if (!session) {
      navigate('/student');
      return;
    }

    void (async () => {
      const response = await fetch('/.netlify/functions/getStudentText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.token }),
      });

      if (!response.ok) {
        setMessage('No se encontro texto asignado.');
        return;
      }

      const payload = (await response.json()) as { text: AssignedText };
      setText(payload.text);
    })();
  }, [navigate, session]);

  useEffect(() => {
    if (!startedAt || !listening) return;

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 500);

    return () => clearInterval(timer);
  }, [listening, startedAt]);

  if (!session) return null;

  const handleStart = () => {
    reset();
    setStartedAt(new Date());
    setElapsed(0);
    setFinished(false);
    setComparedTokens([]);
    start();
  };

  const handleStop = async () => {
    if (!startedAt || !text) return;

    stop();
    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
    const wordCountRead = tokenizeWords(transcript).length;
    const wpm = calculateWpm(wordCountRead, durationSeconds);
    const accuracy = computeAccuracy(text.content, transcript) * 100;
    const invalidShort = durationSeconds < 10;

    setSaving(true);

    const payload = {
      class_id: session.class_id,
      student_id: session.student_id,
      text_id: text.id,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      word_count_read: wordCountRead,
      wpm,
      accuracy,
      invalid_short: invalidShort,
      transcript_snippet: transcript.slice(0, 250),
    };

    await fetch('/.netlify/functions/submitSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session.token, payload }),
    });

    saveLastResult({ wpm, accuracy, duration_seconds: durationSeconds, invalid_short: invalidShort });
    setComparedTokens(buildComparedTokens(text.content, transcript));
    setFinished(true);
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-white">Lectura en voz alta</h2>
        <p className="text-sm text-slate-400">Tiempo: <span className="font-semibold text-cyan-300">{elapsed}s</span></p>
      </div>
      <p className="text-sm text-slate-300">Bienvenido {session.student_name}.</p>

      {!supported && <p className="rounded-xl border border-amber-700/40 bg-amber-950/50 p-3 text-sm text-amber-200">Tu navegador no soporta Web Speech API. Usa Chrome para mejor compatibilidad.</p>}

      {text ? (
        <article className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <h3 className="text-lg font-semibold text-cyan-300">{text.title}</h3>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-200">{text.content}</p>
        </article>
      ) : (
        <p className="text-slate-400">Cargando texto...</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleStart} disabled={!supported || listening || saving}>Iniciar</button>
        <button className="rounded-xl bg-rose-500 px-4 py-2 font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleStop} disabled={!listening || saving}>Detener</button>
        {listening && <p className="text-sm font-medium text-emerald-300">Escuchando...</p>}
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-300">Transcripcion detectada</h3>
        <p className="mt-2 min-h-10 whitespace-pre-wrap text-slate-200">{transcript || 'Empieza a leer para ver el texto detectado en tiempo real.'}</p>
      </section>

      {speechDebug && (
        <section className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-amber-300">Speech Debug</h3>
          <p className="mt-2 text-xs text-amber-100/90">Activa este modo con <span className="font-mono">?speechDebug=1</span>.</p>
          <p className="mt-2 text-xs text-amber-200">Final: {finalTranscript || '(vacio)'}</p>
          <p className="mt-1 text-xs text-amber-200">Interim: {interimTranscript || '(vacio)'}</p>
          <div className="mt-3 max-h-40 overflow-auto rounded border border-amber-700/40 bg-slate-950/50 p-2">
            {debugEvents.length === 0 ? (
              <p className="text-xs text-amber-100/70">Sin eventos todavía.</p>
            ) : (
              <ul className="space-y-2 text-xs text-amber-100/90">
                {debugEvents.map((event, index) => (
                  <li key={`${event.timestamp}-${index}`} className="rounded border border-amber-700/30 p-2">
                    <p className="font-mono">t={event.timestamp} idx={event.resultIndex} len={event.resultsLength}</p>
                    <p>final: {event.finalChunk || '(vacio)'}</p>
                    <p>interim: {event.interimChunk || '(vacio)'}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {finished && text && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-300">Revision del texto original</h3>
          <p className="mt-2 leading-relaxed">
            {comparedTokens.map((token, index) => (
              <span key={`${token.raw}-${index}`} className={token.missed ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                {token.raw}{' '}
              </span>
            ))}
          </p>
          <p className="mt-3 text-xs text-slate-400">Las palabras en rojo son las no detectadas correctamente.</p>
          <button className="mt-4 rounded-xl bg-indigo-500 px-4 py-2 font-semibold text-white transition hover:bg-indigo-400" onClick={() => navigate('/student/results')}>
            Ver resultado final
          </button>
        </section>
      )}

      {error && <p className="rounded-lg border border-rose-700/40 bg-rose-950/40 p-2 text-sm text-rose-300">{error}</p>}
      {message && <p className="rounded-lg border border-amber-700/40 bg-amber-950/40 p-2 text-sm text-amber-300">{message}</p>}
    </div>
  );
}
