import { z } from 'zod';
import { requireTeacherUser } from './_shared/auth';
import { fail, ok } from './_shared/http';
import { hashPin } from './_shared/security';
import { supabaseAdmin } from './_shared/supabaseAdmin';

const schema = z.object({
  class_id: z.string().uuid(),
  students: z.array(z.object({ display_name: z.string().min(1), pin: z.string().regex(/^\d{4}$/) })).min(1),
});

export async function handler(event: { body: string | null; httpMethod: string; headers?: Record<string, string | undefined> }) {
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 405);

  const auth = await requireTeacherUser(event);
  if ('error' in auth) return auth.error;

  const parsed = schema.safeParse(JSON.parse(event.body ?? '{}'));
  if (!parsed.success) return fail('Invalid payload', 422);

  const { class_id, students } = parsed.data;
  const { data: membership } = await supabaseAdmin
    .from('class_memberships')
    .select('class_id')
    .eq('class_id', class_id)
    .eq('user_id', auth.userId)
    .single();

  if (!membership) return fail('Forbidden', 403);

  const prepared = await Promise.all(students.map(async (student) => ({
    class_id,
    display_name: student.display_name.trim(),
    pin_hash: await hashPin(student.pin),
  })));

  const { error } = await supabaseAdmin.from('students').insert(prepared);
  if (error) return fail(error.message, 400);
  return ok({ ok: true, count: prepared.length });
}
