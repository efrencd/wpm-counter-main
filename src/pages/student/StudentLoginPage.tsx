import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveStudentSession } from '../../lib/studentSession';
import { StudentAuthResponse } from '../../lib/types';

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const response = await fetch('/.netlify/functions/studentLogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ join_code: joinCode, name, pin }),
    });

    if (!response.ok) {
      setError('No se pudo validar acceso. Revisa código, nombre o PIN.');
      return;
    }

    const data = (await response.json()) as StudentAuthResponse;
    saveStudentSession({ token: data.token, class_id: data.class_id, student_id: data.student_id, grade: data.grade });
    navigate('/student/reading');
  };

  return (
    <section className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Entrada alumnado</h2>
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <input className="w-full rounded border px-3 py-2 uppercase" placeholder="Código de clase" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} required />
        <input className="w-full rounded border px-3 py-2" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="w-full rounded border px-3 py-2" maxLength={4} minLength={4} placeholder="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} required />
        <button className="w-full rounded bg-blue-600 px-4 py-2 text-white">Entrar</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
