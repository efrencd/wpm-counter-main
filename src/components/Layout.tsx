import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="font-semibold">Lectura WPM Colegio</h1>
          <div className="space-x-3 text-sm">
            <Link className="text-blue-600" to="/teacher">Profesorado</Link>
            <Link className="text-blue-600" to="/student">Alumnado</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
