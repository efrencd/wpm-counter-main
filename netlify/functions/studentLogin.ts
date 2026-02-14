import { z } from 'zod';
import { fail, ok } from './_shared/http';
import { generateSessionToken, hashToken, verifyPin } from './_shared/security';
import { supabaseAdmin } from './_shared/supabaseAdmin';

const schema = z.object({
  join_code: z.string().trim().min(4).max(8),
  name: z.string().trim().min(1),
  pin: z.string().regex(/^\d{4}$/),
});

export default async () => {
  return fail('Use POST', 405);
};

export async function handler(event: { body: string | null; httpMethod: string }) {
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 405);

  const parsed = schema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!parsed.success) return fail('Invalid payload', 422);

  const { join_code, name, pin } = parsed.data;

  const { data: classData } = await supabaseAdmin
    .from('classes')
    .select('id, grade, active_text_id')
    .eq('join_code', join_code.toUpperCase())
    .single();

  if (!classData) return fail('Class not found', 401);

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, pin_hash, active')
    .eq('class_id', classData.id)
    .ilike('display_name', name)
    .single();

  if (!student || !student.active) return fail('Student not found', 401);

  const pinValid = await verifyPin(pin, student.pin_hash);
  if (!pinValid) return fail('Invalid credentials', 401);

  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

  await supabaseAdmin.from('student_sessions').insert({
    token_hash: tokenHash,
    student_id: student.id,
    class_id: classData.id,
    expires_at: expiresAt,
  });

  return ok({
    token,
    student_id: student.id,
    class_id: classData.id,
    grade: classData.grade,
    active_text_id: classData.active_text_id,
  });
}
