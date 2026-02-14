import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ClassRecord } from '../../lib/types';

function randomJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function TeacherDashboardPage() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(1);

  const loadClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('name');
    setClasses((data as ClassRecord[]) ?? []);
  };

  useEffect(() => {
    void loadClasses();
  }, []);

  const createClass = async (event: FormEvent) => {
    event.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const joinCode = randomJoinCode();

    const { data: cls } = await supabase
      .from('classes')
      .insert({ name, grade, join_code: joinCode, created_by: userData.user.id })
      .select()
      .single();

    if (cls) {
      await supabase
        .from('class_memberships')
        .insert({ class_id: cls.id, user_id: userData.user.id, role: 'owner' });
    }

    setName('');
    await loadClasses();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Crear clase</h2>
        <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={createClass}>
          <input className="rounded border px-3 py-2" placeholder="Nombre de clase" value={name} onChange={(e) => setName(e.target.value)} required />
          <select className="rounded border px-3 py-2" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}º</option>)}
          </select>
          <button className="rounded bg-blue-600 px-4 py-2 text-white">Crear</button>
        </form>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Mis clases</h2>
        <ul className="mt-3 space-y-2">
          {classes.map((cls) => (
            <li className="flex items-center justify-between rounded border p-3" key={cls.id}>
              <div>
                <p className="font-medium">{cls.name} ({cls.grade}º)</p>
                <p className="text-sm text-slate-600">Código: {cls.join_code}</p>
              </div>
              <div className="space-x-2">
                <button className="rounded border px-2 py-1 text-sm" onClick={() => navigator.clipboard.writeText(cls.join_code)}>Copiar código</button>
                <Link className="rounded bg-slate-900 px-3 py-1 text-sm text-white" to={`/teacher/class/${cls.id}`}>Abrir</Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
