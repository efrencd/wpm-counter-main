import { z } from 'zod';
import { fail, ok } from './_shared/http';
import { hashToken } from './_shared/security';
import { supabaseAdmin } from './_shared/supabaseAdmin';

const payloadSchema = z.object({
  class_id: z.string().uuid(),
  student_id: z.string().uuid(),
  text_id: z.string().uuid(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  duration_seconds: z.number().int().positive(),
  word_count_read: z.number().int().nonnegative(),
  wpm: z.number().nonnegative(),
  accuracy: z.number().min(0).max(100),
  invalid_short: z.boolean(),
  transcript_snippet: z.string().max(250).nullable().optional(),
});

const schema = z.object({
  token: z.string().min(20),
  payload: payloadSchema,
});

export async function handler(event: { body: string | null; httpMethod: string }) {
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 405);
  const parsed = schema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!parsed.success) return fail('Invalid payload', 422);

  const tokenHash = hashToken(parsed.data.token);
  const { data: session } = await supabaseAdmin
    .from('student_sessions')
    .select('class_id, student_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!session || new Date(session.expires_at).getTime() < Date.now()) return fail('Invalid token', 401);

  if (session.class_id !== parsed.data.payload.class_id || session.student_id !== parsed.data.payload.student_id) {
    return fail('Session mismatch', 403);
  }

  await supabaseAdmin.from('reading_sessions').insert(parsed.data.payload);
  return ok({ ok: true });
}
