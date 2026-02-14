create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'membership_role'
      and n.nspname = 'public'
  ) then
    create type public.membership_role as enum ('owner', 'teacher');
  end if;
end
$$;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade int not null check (grade between 1 and 6),
  join_code varchar(8) not null unique,
  active_text_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.class_memberships (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'teacher',
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  display_name text not null,
  pin_hash text not null,
  pin_plain varchar(4),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(class_id, display_name)
);

alter table public.students
  add column if not exists pin_plain varchar(4);

create table if not exists public.texts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  grade int not null check (grade between 1 and 6),
  title text not null,
  content text not null,
  word_count int not null,
  difficulty_tag text,
  topic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  text_id uuid not null references public.texts(id) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds int not null,
  word_count_read int not null,
  wpm numeric(8,2) not null,
  accuracy numeric(5,2) not null,
  invalid_short boolean not null default false,
  transcript_snippet text,
  created_at timestamptz not null default now()
);

create table if not exists public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_active_text_fkey'
  ) then
    alter table public.classes
      add constraint classes_active_text_fkey
      foreign key (active_text_id) references public.texts(id) on delete set null;
  end if;
end
$$;

create index if not exists idx_reading_sessions_student_started
  on public.reading_sessions(student_id, started_at desc);

create index if not exists idx_reading_sessions_class_started
  on public.reading_sessions(class_id, started_at desc);

create index if not exists idx_students_class_name
  on public.students(class_id, display_name);

create index if not exists idx_classes_join_code on public.classes(join_code);
create index if not exists idx_student_sessions_student on public.student_sessions(student_id);
create index if not exists idx_texts_grade on public.texts(grade);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_texts_updated_at on public.texts;

create trigger trg_texts_updated_at
before update on public.texts
for each row execute procedure public.set_updated_at();
