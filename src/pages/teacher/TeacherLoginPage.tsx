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
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      return;
    }
    navigate('/teacher');
  };

  const handleMagicLink = async () => {
    const { error: authError } = await supabase.auth.signInWithOtp({ email });
    setError(authError ? authError.message : 'Magic link enviado. Revisa tu correo.');
  };

  return (
    <section className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Acceso profesorado</h2>
      <form className="mt-4 space-y-3" onSubmit={handleEmailPassword}>
        <input className="w-full rounded border px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full rounded bg-blue-600 px-4 py-2 text-white">Entrar</button>
      </form>
      <button className="mt-3 text-sm text-blue-600" onClick={handleMagicLink}>Enviar magic link</button>
      {error && <p className="mt-2 text-sm text-slate-600">{error}</p>}
    </section>
  );
}
