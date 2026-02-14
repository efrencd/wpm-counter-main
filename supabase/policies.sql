alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.students enable row level security;
alter table public.texts enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.student_sessions enable row level security;

create or replace function public.is_member(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_memberships cm
    where cm.class_id = target_class
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_memberships cm
    where cm.class_id = target_class
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
  );
$$;

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self upsert" on public.profiles;
drop policy if exists "classes members read" on public.classes;
drop policy if exists "classes creator read" on public.classes;
drop policy if exists "classes members update" on public.classes;
drop policy if exists "classes owner insert" on public.classes;
drop policy if exists "classes owner delete" on public.classes;
drop policy if exists "memberships teacher read" on public.class_memberships;
drop policy if exists "memberships creator bootstrap owner" on public.class_memberships;
drop policy if exists "memberships owner manage" on public.class_memberships;
drop policy if exists "students member read" on public.students;
drop policy if exists "students member write" on public.students;
drop policy if exists "texts read by class membership" on public.texts;
drop policy if exists "texts owner write" on public.texts;
drop policy if exists "sessions members read" on public.reading_sessions;
drop policy if exists "sessions members write" on public.reading_sessions;

create policy "profiles self read" on public.profiles
for select using (user_id = auth.uid());

create policy "profiles self upsert" on public.profiles
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "classes members read" on public.classes
for select using (public.is_member(id));

create policy "classes creator read" on public.classes
for select using (created_by = auth.uid());

create policy "classes members update" on public.classes
for update using (public.is_member(id)) with check (public.is_member(id));

create policy "classes owner insert" on public.classes
for insert with check (created_by = auth.uid());

create policy "classes owner delete" on public.classes
for delete using (public.is_owner(id));

create policy "memberships teacher read" on public.class_memberships
for select using (user_id = auth.uid() or public.is_owner(class_id));

create policy "memberships creator bootstrap owner" on public.class_memberships
for insert
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.classes c
    where c.id = class_id
      and c.created_by = auth.uid()
  )
);

create policy "memberships owner manage" on public.class_memberships
for all using (public.is_owner(class_id)) with check (public.is_owner(class_id));

create policy "students member read" on public.students
for select using (public.is_member(class_id));

create policy "students member write" on public.students
for all using (public.is_member(class_id)) with check (public.is_member(class_id));

create policy "texts read by class membership" on public.texts
for select using (
  created_by = auth.uid() or exists (
    select 1 from public.class_memberships cm
    join public.classes c on c.id = cm.class_id
    where cm.user_id = auth.uid() and c.grade = texts.grade
  )
);

create policy "texts owner write" on public.texts
for all using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "sessions members read" on public.reading_sessions
for select using (public.is_member(class_id));

create policy "sessions members write" on public.reading_sessions
for all using (public.is_member(class_id)) with check (public.is_member(class_id));

-- Keep strict: only service role should access student_sessions for login flow.
