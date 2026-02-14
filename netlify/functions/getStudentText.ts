import { z } from 'zod';
import { fail, ok } from './_shared/http';
import { getMethod, getRawBody } from './_shared/request';
import { hashToken } from './_shared/security';
import { getSupabaseAdmin } from './_shared/supabaseAdmin';

const schema = z.object({ token: z.string().min(20) });

async function resolveSession(token: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  const { data } = await supabaseAdmin
    .from('student_sessions')
    .select('student_id, class_id, expires_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', now)
    .single();

  return data;
}

export async function handler(event: { body: string | null; httpMethod: string }) {
  const supabaseAdmin = getSupabaseAdmin();
  if (getMethod(event) !== 'POST') return fail('Method not allowed', 405);
  const parsed = schema.safeParse(JSON.parse(await getRawBody(event)));
  if (!parsed.success) return fail('Invalid payload', 422);

  const session = await resolveSession(parsed.data.token);
  if (!session) return fail('Session not found', 401);

  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('grade, active_text_id')
    .eq('id', session.class_id)
    .single();

  if (!cls) return fail('Class not found', 404);

  if (cls.active_text_id) {
    const { data: text } = await supabaseAdmin.from('texts').select('*').eq('id', cls.active_text_id).single();
    if (text) return ok({ text });
  }

  const { data: texts } = await supabaseAdmin.from('texts').select('*').eq('grade', cls.grade);
  if (!texts || texts.length === 0) return fail('No hay textos para este curso', 404);

  const randomText = texts[Math.floor(Math.random() * texts.length)];
  return ok({ text: randomText });
}
