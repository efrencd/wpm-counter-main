import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateWpm, computeAccuracy, tokenizeWords } from '../../lib/textMetrics';
import { getStudentSession, saveLastResult } from '../../lib/studentSession';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

interface AssignedText {
  id: string;
  title: string;
  content: string;
}

export default function StudentReadingPage() {
  const navigate = useNavigate();
  const [text, setText] = useState<AssignedText | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { supported, transcript, listening, error, start, stop, reset } = useSpeechRecognition();

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
        setMessage('No se encontró texto asignado.');
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
    setSaving(false);
    navigate('/student/results');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Lectura en voz alta</h2>
      {!supported && <p className="rounded bg-amber-100 p-3 text-sm">Tu navegador no soporta Web Speech API. En Chrome para Chromebook debería funcionar.</p>}
      {text ? (
        <article className="rounded border p-4">
          <h3 className="font-medium">{text.title}</h3>
          <p className="mt-2 leading-relaxed">{text.content}</p>
        </article>
      ) : <p>Cargando texto...</p>}
      <div className="flex items-center gap-4">
        <button className="rounded bg-green-600 px-4 py-2 text-white" onClick={handleStart} disabled={!supported || listening}>Start</button>
        <button className="rounded bg-red-600 px-4 py-2 text-white" onClick={handleStop} disabled={!listening || saving}>Stop</button>
        <p className="text-sm">Tiempo: {elapsed}s</p>
        {listening && <p className="text-sm text-green-700">Escuchando…</p>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-amber-700">{message}</p>}
    </div>
  );
}
