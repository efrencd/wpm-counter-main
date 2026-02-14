import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function TeacherLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleEmailPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      return;
    }

    navigate('/teacher');
  };

  const handleMagicLink = async () => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOtp({ email });
    setError(authError ? authError.message : 'Magic link enviado. Revisa tu correo.');
  };

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40">
      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Profesorado</p>
      <h2 className="mt-2 text-2xl font-bold text-white">Acceso al panel</h2>
      <p className="mt-1 text-sm text-slate-400">Gestiona clases, alumnado y resultados de lectura.</p>

      <form className="mt-5 space-y-3" onSubmit={handleEmailPassword}>
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400"
          type="password"
          placeholder="Contrasena"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="w-full rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400">
          Entrar
        </button>
      </form>

      <button className="mt-3 w-full rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800" onClick={handleMagicLink}>
        Enviar magic link
      </button>

      {error && <p className="mt-3 rounded-lg border border-rose-700/40 bg-rose-950/40 p-2 text-sm text-rose-300">{error}</p>}
    </section>
  );
}
