# WPM Colegio (React + Supabase + Netlify)

Webapp MVP+ para medir fluidez lectora en voz alta (WPM y precisión) en colegio.

## Stack
- Frontend: React + Vite + TypeScript + Tailwind
- Backend: Supabase (Postgres + Auth + RLS)
- Serverless: Netlify Functions para flujo de alumnado (PIN/token)
- Gráficos: Recharts

## Flujo principal
1. Profesor/a inicia sesión en `/teacher/login` (email/password o magic link).
2. Crea clase con `join_code` y alumnado con PIN de 4 dígitos.
3. Crea textos por curso.
4. Alumno/a entra en `/student` con código + nombre + PIN.
5. Lee en `/student/reading` usando Web Speech API (Chrome/Chromebook).
6. Se calcula WPM + precisión (WER), se guarda en `reading_sessions`.
7. Profesorado ve evolución, tabla y gráficos en `/teacher/class/:id`, con export CSV.

## Setup local
```bash
npm install
npm run dev
```

Si vas a probar flujo de alumnado (usa Netlify Functions), inicia en local con:
```bash
npm run dev:netlify
```

## Configuración Supabase
1. Crea proyecto en Supabase.
2. En SQL editor ejecuta:
   - `supabase/schema.sql`
   - `supabase/policies.sql`
   - Si ya tenías tablas creadas, vuelve a ejecutar `supabase/schema.sql` para añadir columnas nuevas (por ejemplo `students.pin_plain`).
3. Crea usuarios docentes en Auth.
4. Para cada alumno, el hash del PIN se calcula en Netlify Functions con bcrypt.

## Variables de entorno
Copia `.env.example` a `.env` para local y configura las mismas en Netlify Site Settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` (igual que `VITE_SUPABASE_URL`, usado por functions)

## Deploy en Netlify
1. Sube repo a GitHub.
2. En Netlify: **Add new site > Import from GitHub**.
3. Netlify detecta `netlify.toml`:
   - build: `npm run build`
   - publish: `dist`
   - functions: `netlify/functions`
4. Añade variables de entorno en Netlify.
5. Deploy.

## Seguridad y privacidad
- No se guarda audio.
- PIN siempre hasheado (bcrypt).
- Tokens de alumnado efímeros (`student_sessions`, expiración 8h).
- El alumnado no usa directamente Supabase anon key para lecturas.
- RLS estricto para tablas de profesorado.

## Endpoints Netlify Functions
- `POST /.netlify/functions/studentLogin` `{join_code,name,pin}`
- `POST /.netlify/functions/getStudentText` `{token}`
- `POST /.netlify/functions/submitSession` `{token,payload}`

## Nota de compatibilidad Speech API
La lectura automática requiere `SpeechRecognition`/`webkitSpeechRecognition` (Chrome recomendado en Chromebook). Si no está disponible, la UI muestra fallback informativo.
