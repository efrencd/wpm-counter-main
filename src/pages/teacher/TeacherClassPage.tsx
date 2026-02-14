import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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

export default function TeacherClassPage() {
  const { id } = useParams();
  const [classGrade, setClassGrade] = useState<number>(1);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [texts, setTexts] = useState<TextRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [studentName, setStudentName] = useState('');
  const [pin, setPin] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [activeTextId, setActiveTextId] = useState<string>('');

  const loadData = async () => {
    if (!id) return;
    const [classRes, studentsRes, textsRes, sessionsRes] = await Promise.all([
      supabase.from('classes').select('grade, active_text_id').eq('id', id).single(),
      supabase.from('students').select('*').eq('class_id', id).order('display_name'),
      supabase.from('texts').select('*').order('updated_at', { ascending: false }),
      supabase.from('reading_sessions').select('*, students(display_name), texts(title)').eq('class_id', id).order('started_at', { ascending: false }),
    ]);

    setClassGrade(classRes.data?.grade ?? 1);
    setActiveTextId(classRes.data?.active_text_id ?? '');
    setStudents((studentsRes.data as StudentRecord[]) ?? []);
    setTexts((textsRes.data as TextRecord[]) ?? []);
    setSessions((sessionsRes.data as SessionRow[]) ?? []);
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const createStudents = async (batch: Array<{ display_name: string; pin: string }>) => {
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt || !id || batch.length === 0) return;

    await fetch('/.netlify/functions/manageStudents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ class_id: id, students: batch }),
    });

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
      .map((name) => name.trim())
      .filter(Boolean)
      .map((display_name) => ({ display_name, pin: Math.floor(1000 + Math.random() * 9000).toString() }));
    await createStudents(parsed);
    setBulkNames('');
  };

  const createText = async (event: FormEvent) => {
    event.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const wordCount = tokenizeWords(content).length;
    await supabase.from('texts').insert({ title, content, grade: classGrade, word_count: wordCount, created_by: userData.user.id });
    setTitle('');
    setContent('');
    await loadData();
  };

  const assignActiveText = async () => {
    if (!id) return;
    await supabase.from('classes').update({ active_text_id: activeTextId || null }).eq('id', id);
    await loadData();
  };

  const chartData = useMemo(() => {
    return [...sessions]
      .reverse()
      .map((session) => ({
        date: new Date(session.started_at).toLocaleDateString(),
        wpm: session.wpm,
        accuracy: session.accuracy,
      }));
  }, [sessions]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Alumnado</h2>
        <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={createStudent}>
          <input className="rounded border px-3 py-2" placeholder="Nombre" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
          <input className="rounded border px-3 py-2" maxLength={4} minLength={4} placeholder="PIN 4 dígitos" value={pin} onChange={(e) => setPin(e.target.value)} required />
          <button className="rounded bg-blue-600 px-4 py-2 text-white">Alta alumno</button>
        </form>
        <textarea className="mt-3 w-full rounded border px-3 py-2" placeholder="Alta rápida: un nombre por línea" value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} />
        <button className="mt-2 rounded border px-3 py-1 text-sm" onClick={createBulkStudents}>Crear en bloque (PIN aleatorio)</button>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {students.map((student) => <li className="rounded border p-2" key={student.id}>{student.display_name}</li>)}
        </ul>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Textos</h2>
        <form className="mt-3 space-y-2" onSubmit={createText}>
          <input className="w-full rounded border px-3 py-2" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea className="w-full rounded border px-3 py-2" rows={4} placeholder="Contenido" value={content} onChange={(e) => setContent(e.target.value)} required />
          <button className="rounded bg-blue-600 px-4 py-2 text-white">Guardar texto</button>
        </form>

        <div className="mt-3 flex gap-2">
          <select className="rounded border px-3 py-2" value={activeTextId} onChange={(e) => setActiveTextId(e.target.value)}>
            <option value="">Sin texto activo (aleatorio)</option>
            {texts.filter((text) => text.grade === classGrade).map((text) => <option key={text.id} value={text.id}>{text.title}</option>)}
          </select>
          <button className="rounded border px-3 py-2" onClick={assignActiveText}>Asignar texto activo</button>
        </div>

        <ul className="mt-3 space-y-2">
          {texts.filter((text) => text.grade === classGrade).map((text) => (
            <li className="rounded border p-2" key={text.id}>
              <p className="font-medium">{text.title}</p>
              <p className="text-sm text-slate-600">{text.word_count} palabras</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Métricas y evolución</h2>
          <button
            className="rounded border px-3 py-1 text-sm"
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

        <div className="mt-4 h-72">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" dataKey="wpm" stroke="#2563eb" name="WPM" />
              <Line yAxisId="right" dataKey="accuracy" stroke="#16a34a" name="Precisión %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <table className="mt-4 w-full table-auto text-sm">
          <thead>
            <tr className="text-left">
              <th>Fecha</th>
              <th>Alumno/a</th>
              <th>Texto</th>
              <th>WPM</th>
              <th>Precisión</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>{new Date(session.started_at).toLocaleDateString()}</td>
                <td>{session.students?.display_name}</td>
                <td>{session.texts?.title}</td>
                <td>{session.wpm}</td>
                <td>{session.accuracy.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
