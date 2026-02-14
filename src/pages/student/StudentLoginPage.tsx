import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { saveStudentSession } from '../../lib/studentSession';
import { StudentAuthResponse } from '../../lib/types';

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) setJoinCode(codeFromUrl.toUpperCase());
  }, [searchParams]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    let response: Response;

    try {
      response = await fetch('/.netlify/functions/studentLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ join_code: joinCode, name, pin }),
      });
    } catch (_error) {
      setError('No se pudo conectar con las funciones locales. Inicia con npm run dev:netlify.');
      return;
    }

    if (response.status === 404) {
      setError('Faltan Netlify Functions en local. Inicia con npm run dev:netlify.');
      return;
    }

    if (!response.ok) {
      let details = '';
      try {
        const body = (await response.json()) as { error?: string };
        details = body.error ? ` (${body.error})` : '';
      } catch (_error) {
        details = '';
      }

      setError(`No se pudo validar acceso. Revisa codigo, nombre o PIN.${details}`);
      return;
    }

    const data = (await response.json()) as StudentAuthResponse;
    saveStudentSession({
      token: data.token,
      class_id: data.class_id,
      student_id: data.student_id,
      grade: data.grade,
      student_name: name.trim(),
    });
    navigate('/student/reading');
  };

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40">
      <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Alumnado</p>
      <h2 className="mt-2 text-2xl font-bold text-white">Entrada a la clase</h2>
      <p className="mt-1 text-sm text-slate-400">Introduce tus datos para empezar la lectura.</p>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 uppercase text-slate-100 outline-none transition focus:border-indigo-400" placeholder="Codigo de clase" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} required />
        <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-indigo-400" placeholder="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
        <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-indigo-400" maxLength={4} minLength={4} placeholder="PIN" type="password" value={pin} onChange={(event) => setPin(event.target.value)} required />
        <button className="w-full rounded-xl bg-indigo-500 px-4 py-2 font-semibold text-white transition hover:bg-indigo-400">Entrar</button>
      </form>

      {error && <p className="mt-3 rounded-lg border border-rose-700/40 bg-rose-950/40 p-2 text-sm text-rose-300">{error}</p>}
    </section>
  );
}
