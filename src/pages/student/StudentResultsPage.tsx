import { Link } from 'react-router-dom';
import { getLastResult } from '../../lib/studentSession';

export default function StudentResultsPage() {
  const result = getLastResult();

  return (
    <section className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Resultado lectura</h2>
      {result ? (
        <dl className="mt-4 space-y-2">
          <div className="flex justify-between"><dt>WPM</dt><dd>{result.wpm}</dd></div>
          <div className="flex justify-between"><dt>Precisión</dt><dd>{result.accuracy.toFixed(1)}%</dd></div>
          <div className="flex justify-between"><dt>Duración</dt><dd>{result.duration_seconds}s</dd></div>
          {result.invalid_short && <p className="rounded bg-amber-100 p-2 text-sm">Lectura corta (&lt;10s), revisar validez.</p>}
        </dl>
      ) : <p>No hay resultados recientes.</p>}
      <Link className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white" to="/student/reading">Nueva lectura</Link>
    </section>
  );
}
