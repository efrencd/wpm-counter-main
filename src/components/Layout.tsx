import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function navClassName(active: boolean) {
  return active
    ? 'rounded-lg bg-sky-500/20 px-3 py-2 text-sm font-semibold text-sky-200'
    : 'rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white';
}

export default function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isStudentRoute = pathname.startsWith('/student');
  const inTeacherPanel = pathname.startsWith('/teacher') && pathname !== '/teacher/login';

  const handleTeacherLogout = async () => {
    await supabase.auth.signOut();
    navigate('/teacher/login');
  };

  return (
    <div className="min-h-screen">
      {!isStudentRoute && (
        <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">WPM Counter</p>
              <h1 className="text-lg font-bold text-white">Lectura Escolar</h1>
            </div>
            <div className="flex items-center gap-2">
              <NavLink className={({ isActive }) => navClassName(isActive)} to="/teacher/login">Acceso docente</NavLink>
              <NavLink className={({ isActive }) => navClassName(isActive)} to="/teacher">Panel profesor</NavLink>
              <NavLink className={({ isActive }) => navClassName(isActive)} to="/student">Acceso alumnado</NavLink>
              {inTeacherPanel && (
                <button className="rounded-lg border border-rose-700/50 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-950/40" onClick={handleTeacherLogout}>
                  Logout profe
                </button>
              )}
            </div>
          </nav>
          {inTeacherPanel && (
            <div className="border-t border-slate-800/80 bg-slate-900/70">
              <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
                <NavLink className={({ isActive }) => navClassName(isActive)} to="/teacher">Mis clases</NavLink>
                <NavLink className={({ isActive }) => navClassName(isActive)} to="/student">Vista alumnado</NavLink>
              </div>
            </div>
          )}
        </header>
      )}

      <main className={isStudentRoute ? 'mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6' : 'mx-auto max-w-7xl px-4 py-8'}>
        <Outlet />
      </main>
    </div>
  );
}
