import { z } from 'zod';
import { fail, ok } from './_shared/http';
import { getMethod, getRawBody } from './_shared/request';
import { generateSessionToken, hashToken, verifyPin } from './_shared/security';
import { getSupabaseAdmin } from './_shared/supabaseAdmin';

const schema = z.object({
  join_code: z.string().trim().min(4).max(8),
  name: z.string().trim().min(1),
  pin: z.string().regex(/^\d{4}$/),
});

export async function handler(event: { body: string | null; httpMethod: string }) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (getMethod(event) !== 'POST') return fail('Method not allowed', 405);

    const rawBody = await getRawBody(event);
    let body: unknown = {};
    try {
      body = JSON.parse(rawBody);
    } catch (_error) {
      return fail('Invalid JSON payload', 422);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail('Invalid payload', 422);

    const { join_code, name, pin } = parsed.data;

    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, grade, active_text_id')
      .eq('join_code', join_code.toUpperCase())
      .single();

    if (classError || !classData) return fail('Class not found', 401);

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, pin_hash, active')
      .eq('class_id', classData.id)
      .ilike('display_name', name)
      .single();

    if (studentError || !student || !student.active) return fail('Student not found', 401);

    const pinValid = await verifyPin(pin, student.pin_hash);
    if (!pinValid) return fail('Invalid credentials', 401);

    const token = generateSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const { error: sessionError } = await supabaseAdmin.from('student_sessions').insert({
      token_hash: tokenHash,
      student_id: student.id,
      class_id: classData.id,
      expires_at: expiresAt,
    });

    if (sessionError) return fail(sessionError.message, 500);

    return ok({
      token,
      student_id: student.id,
      class_id: classData.id,
      grade: classData.grade,
      active_text_id: classData.active_text_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return fail(message, 500);
  }
}
