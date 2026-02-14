import { z } from 'zod';
import { requireTeacherUser } from './_shared/auth';
import { fail, ok } from './_shared/http';
import { getMethod, getRawBody } from './_shared/request';
import { hashPin } from './_shared/security';
import { getSupabaseAdmin } from './_shared/supabaseAdmin';

const schema = z.object({
  class_id: z.string().uuid(),
  students: z.array(z.object({ display_name: z.string().min(1), pin: z.string().regex(/^\d{4}$/) })).min(1),
});

export async function handler(event: { body: string | null; httpMethod: string; headers?: Record<string, string | undefined> }) {
  const supabaseAdmin = getSupabaseAdmin();
  if (getMethod(event) !== 'POST') return fail('Method not allowed', 405);

  const auth = await requireTeacherUser(event);
  if ('error' in auth) return auth.error;

  const parsed = schema.safeParse(JSON.parse(await getRawBody(event)));
  if (!parsed.success) return fail('Invalid payload', 422);

  const { class_id, students } = parsed.data;
  let { data: membership } = await supabaseAdmin
    .from('class_memberships')
    .select('class_id')
    .eq('class_id', class_id)
    .eq('user_id', auth.userId)
    .single();

  if (!membership) {
    const { data: cls } = await supabaseAdmin
      .from('classes')
      .select('id, created_by')
      .eq('id', class_id)
      .single();

    if (!cls || cls.created_by !== auth.userId) return fail('Forbidden', 403);

    const { error: bootstrapError } = await supabaseAdmin
      .from('class_memberships')
      .insert({ class_id, user_id: auth.userId, role: 'owner' });

    if (bootstrapError) return fail(bootstrapError.message, 400);
    membership = { class_id };
  }

  const prepared = await Promise.all(students.map(async (student) => ({
    class_id,
    display_name: student.display_name.trim(),
    pin_plain: student.pin,
    pin_hash: await hashPin(student.pin),
  })));

  const { error } = await supabaseAdmin.from('students').insert(prepared);
  if (error) {
    // Backward compatibility for databases that have not added students.pin_plain yet.
    if (error.message.includes('pin_plain')) {
      const fallback = prepared.map(({ class_id, display_name, pin_hash }) => ({ class_id, display_name, pin_hash }));
      const { error: fallbackError } = await supabaseAdmin.from('students').insert(fallback);
      if (fallbackError) return fail(fallbackError.message, 400);
      return ok({ ok: true, count: fallback.length, pin_visibility: false });
    }

    return fail(error.message, 400);
  }

  return ok({ ok: true, count: prepared.length });
}
