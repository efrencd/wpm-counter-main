import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ClassRecord } from '../../lib/types';

function randomJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function buildStudentLink(joinCode: string) {
  if (typeof window === 'undefined') return `/student?code=${joinCode}`;
  return `${window.location.origin}/student?code=${joinCode}`;
}

export default function TeacherDashboardPage() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const sortedClasses = useMemo(() => classes, [classes]);

  const loadClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('name');
    setClasses((data as ClassRecord[]) ?? []);
  };

  useEffect(() => {
    void loadClasses();
  }, []);

  const createClass = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Tu sesion no esta activa. Vuelve a iniciar sesion.');
      return;
    }

    const joinCode = randomJoinCode();
    const classId = crypto.randomUUID();

    const { error: classError } = await supabase
      .from('classes')
      .insert({ id: classId, name, grade, join_code: joinCode, created_by: userData.user.id });

    if (classError) {
      setError(classError.message);
      return;
    }

    const { error: membershipError } = await supabase
      .from('class_memberships')
      .insert({ class_id: classId, user_id: userData.user.id, role: 'owner' });

    if (membershipError) {
      setError(membershipError.message);
      return;
    }

    setName('');
    await loadClasses();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Panel profesor</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Crear clase</h2>
        <form className="mt-4 grid gap-2 sm:grid-cols-3" onSubmit={createClass}>
          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
            placeholder="Nombre de clase"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <select
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
            value={grade}
            onChange={(event) => setGrade(Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>{value}o</option>
            ))}
          </select>
          <button className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400">Crear</button>
        </form>
        {error && <p className="mt-3 rounded-lg border border-rose-700/40 bg-rose-950/40 p-2 text-sm text-rose-300">{error}</p>}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
        <h2 className="text-xl font-bold text-white">Mis clases</h2>
        <ul className="mt-4 space-y-3">
          {sortedClasses.map((cls) => {
            const studentLink = buildStudentLink(cls.join_code);
            return (
              <li className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={cls.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">{cls.name} ({cls.grade}o)</p>
                    <p className="text-sm text-slate-400">Codigo: <span className="font-mono text-cyan-300">{cls.join_code}</span></p>
                    <p className="mt-2 break-all text-xs text-slate-500">Link alumnado: {studentLink}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" onClick={() => navigator.clipboard.writeText(cls.join_code)}>
                      Copiar codigo
                    </button>
                    <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" onClick={() => navigator.clipboard.writeText(studentLink)}>
                      Copiar link
                    </button>
                    <Link className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400" to={`/teacher/class/${cls.id}`}>
                      Abrir clase
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
          {sortedClasses.length === 0 && <li className="text-sm text-slate-400">Todavia no hay clases.</li>}
        </ul>
      </section>
    </div>
  );
}
