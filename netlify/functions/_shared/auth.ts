import { fail } from './http';
import { supabaseAdmin } from './supabaseAdmin';

export async function requireTeacherUser(event: { headers?: Record<string, string | undefined> }) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return { error: fail('Unauthorized', 401) };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { error: fail('Unauthorized', 401) };
  }

  return { userId: data.user.id };
}
