import { Link, useNavigate } from 'react-router-dom';
import { clearStudentSession, getLastResult } from '../../lib/studentSession';

export default function StudentResultsPage() {
  const navigate = useNavigate();
  const result = getLastResult();
  const handleLogout = () => {
    clearStudentSession();
    navigate('/student');
  };

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Resultado</p>
        <button className="rounded-lg border border-rose-700/50 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-950/40" onClick={handleLogout}>
          Logout alumno
        </button>
      </div>
      <h2 className="mt-2 text-2xl font-bold text-white">Lectura completada</h2>

      {result ? (
        <dl className="mt-4 space-y-2 text-slate-200">
          <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"><dt>WPM</dt><dd className="font-semibold text-cyan-300">{result.wpm}</dd></div>
          <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"><dt>Precision</dt><dd className="font-semibold text-emerald-300">{result.accuracy.toFixed(1)}%</dd></div>
          <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"><dt>Duracion</dt><dd className="font-semibold">{result.duration_seconds}s</dd></div>
          {result.invalid_short && <p className="rounded-lg border border-amber-700/40 bg-amber-950/40 p-2 text-sm text-amber-300">Lectura corta (&lt;10s), revisa la validez.</p>}
        </dl>
      ) : (
        <p className="mt-4 text-slate-400">No hay resultados recientes.</p>
      )}

      <Link className="mt-5 inline-block rounded-xl bg-indigo-500 px-4 py-2 font-semibold text-white transition hover:bg-indigo-400" to="/student/reading">Nueva lectura</Link>
    </section>
  );
}
