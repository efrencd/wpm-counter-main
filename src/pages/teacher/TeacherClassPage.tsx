import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { downloadCsv } from '../../lib/csv';
import { supabase } from '../../lib/supabase';
import { ReadingSessionRecord, StudentRecord, TextRecord } from '../../lib/types';
import { tokenizeWords } from '../../lib/textMetrics';

interface SessionRow extends ReadingSessionRecord {
  students?: { display_name: string };
  texts?: { title: string };
}

function buildStudentLink(joinCode: string) {
  if (typeof window === 'undefined') return `/student?code=${joinCode}`;
  return `${window.location.origin}/student?code=${joinCode}`;
}

export default function TeacherClassPage() {
  const { id } = useParams();
  const [className, setClassName] = useState('Clase');
  const [classGrade, setClassGrade] = useState<number>(1);
  const [joinCode, setJoinCode] = useState('');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [texts, setTexts] = useState<TextRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [studentName, setStudentName] = useState('');
  const [pin, setPin] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editTextId, setEditTextId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [activeTextId, setActiveTextId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const studentLink = useMemo(() => (joinCode ? buildStudentLink(joinCode) : ''), [joinCode]);

  const loadData = async () => {
    if (!id) return;

    const [classRes, studentsRes, textsRes, sessionsRes] = await Promise.all([
      supabase.from('classes').select('name, grade, join_code, active_text_id').eq('id', id).single(),
      supabase.from('students').select('*').eq('class_id', id).order('display_name'),
      supabase.from('texts').select('*').order('updated_at', { ascending: false }),
      supabase.from('reading_sessions').select('*, students(display_name), texts(title)').eq('class_id', id).order('started_at', { ascending: false }),
    ]);

    setClassName(classRes.data?.name ?? 'Clase');
    setClassGrade(classRes.data?.grade ?? 1);
    setJoinCode(classRes.data?.join_code ?? '');
    setActiveTextId(classRes.data?.active_text_id ?? '');
    setStudents((studentsRes.data as StudentRecord[]) ?? []);
    setTexts((textsRes.data as TextRecord[]) ?? []);
    setSessions((sessionsRes.data as SessionRow[]) ?? []);
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const createStudents = async (batch: Array<{ display_name: string; pin: string }>) => {
    setError(null);
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt || !id || batch.length === 0) {
      setError('Sesion invalida. Vuelve a iniciar sesion.');
      return;
    }

    const response = await fetch('/.netlify/functions/manageStudents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ class_id: id, students: batch }),
    });

    if (!response.ok) {
      let message = 'No se pudo crear el alumnado.';
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch (_error) {
        // Keep default message
      }
      setError(message);
      return;
    }

    await loadData();
  };

  const createStudent = async (event: FormEvent) => {
    event.preventDefault();
    await createStudents([{ display_name: studentName, pin }]);
    setStudentName('');
    setPin('');
  };

  const createBulkStudents = async () => {
    const parsed = bulkNames
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((display_name) => ({ display_name, pin: Math.floor(1000 + Math.random() * 9000).toString() }));

    await createStudents(parsed);
    setBulkNames('');
  };

  const deleteStudent = async (studentId: string, displayName: string) => {
    const confirmed = window.confirm(`Eliminar a ${displayName} de la clase?`);
    if (!confirmed) return;

    setError(null);
    const { error: deleteError } = await supabase.from('students').delete().eq('id', studentId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadData();
  };

  const createText = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Sesion invalida. Vuelve a iniciar sesion.');
      return;
    }

    const wordCount = tokenizeWords(content).length;
    const { error: textError } = await supabase.from('texts').insert({
      title,
      content,
      grade: classGrade,
      word_count: wordCount,
      created_by: userData.user.id,
    });

    if (textError) {
      setError(textError.message);
      return;
    }

    setTitle('');
    setContent('');
    await loadData();
  };

  const beginEditText = (text: TextRecord) => {
    setEditTextId(text.id);
    setEditTitle(text.title);
    setEditContent(text.content);
  };

  const cancelEditText = () => {
    setEditTextId(null);
    setEditTitle('');
    setEditContent('');
  };

  const saveEditedText = async () => {
    if (!editTextId) return;
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Sesion invalida. Vuelve a iniciar sesion.');
      return;
    }

    const wordCount = tokenizeWords(editContent).length;
    const { error: updateError } = await supabase
      .from('texts')
      .update({ title: editTitle, content: editContent, word_count: wordCount })
      .eq('id', editTextId)
      .eq('created_by', userData.user.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    cancelEditText();
    await loadData();
  };

  const assignActiveText = async () => {
    if (!id) return;
    setError(null);

    const { error: updateError } = await supabase.from('classes').update({ active_text_id: activeTextId || null }).eq('id', id);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadData();
  };

  const chartData = useMemo(() => {
    return [...sessions].reverse().map((session) => ({
      date: new Date(session.started_at).toLocaleDateString(),
      wpm: session.wpm,
      accuracy: session.accuracy,
    }));
  }, [sessions]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Clase activa</p>
            <h2 className="mt-1 text-2xl font-bold text-white">{className} ({classGrade}o)</h2>
            <p className="mt-1 text-sm text-slate-400">Codigo de acceso alumnado: <span className="font-mono text-cyan-300">{joinCode || '---'}</span></p>
            {studentLink && <p className="mt-1 break-all text-xs text-slate-500">Link alumnado: {studentLink}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" onClick={() => joinCode && navigator.clipboard.writeText(joinCode)}>
              Copiar codigo
            </button>
            <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" onClick={() => studentLink && navigator.clipboard.writeText(studentLink)}>
              Copiar link
            </button>
            <Link className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400" to="/teacher">
              Volver a clases
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
        <h3 className="text-xl font-bold text-white">Alumnado</h3>
        <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={createStudent}>
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400" placeholder="Nombre" value={studentName} onChange={(event) => setStudentName(event.target.value)} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400" maxLength={4} minLength={4} placeholder="PIN 4 digitos" value={pin} onChange={(event) => setPin(event.target.value)} required />
          <button className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400">Alta alumno</button>
        </form>

        <textarea className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400" placeholder="Alta rapida: un nombre por linea" value={bulkNames} onChange={(event) => setBulkNames(event.target.value)} />
        <button className="mt-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" onClick={createBulkStudents}>Crear en bloque (PIN aleatorio)</button>

        {error && <p className="mt-3 rounded-lg border border-rose-700/40 bg-rose-950/40 p-2 text-sm text-rose-300">{error}</p>}

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {students.map((student) => (
            <li className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-slate-200" key={student.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{student.display_name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    PIN: <span className="font-mono text-cyan-300">{student.pin_plain ?? 'No disponible'}</span>
                  </p>
                </div>
                <button
                  className="rounded-lg border border-rose-700/50 px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-950/40"
                  onClick={() => deleteStudent(student.id, student.display_name)}
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
          {students.length === 0 && <li className="text-sm text-slate-400">No hay alumnado todavia.</li>}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
        <h3 className="text-xl font-bold text-white">Textos</h3>
        <form className="mt-3 space-y-2" onSubmit={createText}>
          <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400" placeholder="Titulo" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <textarea className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400" rows={4} placeholder="Contenido" value={content} onChange={(event) => setContent(event.target.value)} required />
          <button className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400">Guardar texto</button>
        </form>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400" value={activeTextId} onChange={(event) => setActiveTextId(event.target.value)}>
            <option value="">Sin texto activo (aleatorio)</option>
            {texts.filter((text) => text.grade === classGrade).map((text) => (
              <option key={text.id} value={text.id}>{text.title}</option>
            ))}
          </select>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" onClick={assignActiveText}>Asignar texto activo</button>
        </div>

        <ul className="mt-4 space-y-2">
          {texts.filter((text) => text.grade === classGrade).map((text) => (
            <li className="rounded-lg border border-slate-800 bg-slate-950/70 p-3" key={text.id}>
              {editTextId === text.id ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
                  <textarea
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                    rows={4}
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400" onClick={saveEditedText}>
                      Guardar cambios
                    </button>
                    <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" onClick={cancelEditText}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-100">{text.title}</p>
                    <p className="text-sm text-slate-400">{text.word_count} palabras</p>
                  </div>
                  <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" onClick={() => beginEditText(text)}>
                    Ver / editar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold text-white">Metricas y evolucion</h3>
          <button
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
            onClick={() => downloadCsv(`class-${id}-sessions.csv`, sessions.map((session) => ({
              date: session.started_at,
              student: session.students?.display_name,
              text: session.texts?.title,
              wpm: session.wpm,
              accuracy: session.accuracy,
            })))}
          >
            Exportar CSV
          </button>
        </div>

        <div className="mt-4 h-72 rounded-xl border border-slate-800 bg-slate-950/60 p-2">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }} />
              <Legend />
              <Line yAxisId="left" dataKey="wpm" stroke="#22d3ee" name="WPM" />
              <Line yAxisId="right" dataKey="accuracy" stroke="#34d399" name="Precision %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full table-auto text-sm">
            <thead className="bg-slate-950/70 text-slate-300">
              <tr className="text-left">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Alumno/a</th>
                <th className="px-3 py-2">Texto</th>
                <th className="px-3 py-2">WPM</th>
                <th className="px-3 py-2">Precision</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr className="border-t border-slate-800" key={session.id}>
                  <td className="px-3 py-2 text-slate-300">{new Date(session.started_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-slate-200">{session.students?.display_name}</td>
                  <td className="px-3 py-2 text-slate-200">{session.texts?.title}</td>
                  <td className="px-3 py-2 text-cyan-300">{session.wpm}</td>
                  <td className="px-3 py-2 text-emerald-300">{session.accuracy.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
