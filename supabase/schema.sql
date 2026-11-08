-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Creates the tables, security rules (Row Level Security) and the starting list of classes.

-- ---------- Profiles (one per login) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  role text not null default 'parent' check (role in ('parent', 'student', 'teacher')),
  phone text,
  line_id text,
  created_at timestamptz not null default now()
);

-- New sign-ups get a profile automatically. Nobody can sign up as a teacher.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when new.raw_user_meta_data ->> 'role' in ('parent', 'student')
         then new.raw_user_meta_data ->> 'role' else 'parent' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

-- ---------- Classes ----------
create table if not exists public.courses (
  code text primary key,
  name text not null,
  level text not null,
  subject text not null,
  format text not null check (format in ('group', 'one_to_one')),
  active boolean not null default true
);

insert into public.courses (code, name, level, subject, format) values
  ('primary-maths', 'Singapore Primary Maths', 'primary', 'maths', 'group'),
  ('ks3-maths',     'KS3 Maths group',         'ks3',     'maths', 'group'),
  ('ks4-maths',     'KS4 Maths group',         'ks4',     'maths', 'group'),
  ('ks3-science',   'KS3 Science group',       'ks3',     'science', 'group'),
  ('igcse-1to1',    'IGCSE Maths one-to-one',  'igcse',   'maths', 'one_to_one'),
  ('alevel-1to1',   'A-level & Further Maths one-to-one', 'alevel', 'maths', 'one_to_one')
on conflict (code) do nothing;

create table if not exists public.enrolments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  course_code text not null references public.courses on update cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  unique (user_id, course_code)
);

create or replace function public.is_enrolled(code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrolments
                 where user_id = auth.uid() and course_code = code and status = 'active');
$$;

-- Lesson link and timetable, visible only to enrolled students and the teacher.
create table if not exists public.course_links (
  course_code text primary key references public.courses on update cascade,
  meeting_url text,
  schedule text,
  updated_at timestamptz not null default now()
);

-- Notes, worked solutions and homework.
create table if not exists public.resources (
  id bigint generated always as identity primary key,
  course_code text not null references public.courses on update cascade,
  title text not null check (char_length(title) <= 200),
  url text check (char_length(url) <= 1000),
  due_on date,
  created_at timestamptz not null default now()
);

-- ---------- Trial lesson requests from the public website ----------
create table if not exists public.enquiries (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  parent_name text not null check (char_length(parent_name) between 1 and 120),
  student_name text not null check (char_length(student_name) between 1 and 120),
  email text check (char_length(email) <= 200),
  phone_or_line text not null check (char_length(phone_or_line) between 1 and 120),
  level text check (char_length(level) <= 30),
  subject text check (char_length(subject) <= 30),
  message text check (char_length(message) <= 2000),
  lang text check (char_length(lang) <= 5),
  status text not null default 'new' check (status in ('new', 'contacted'))
);

-- ---------- Payments (written only by the Stripe webhook, using the service role key) ----------
create table if not exists public.payments (
  id bigint generated always as identity primary key,
  stripe_session_id text unique not null,
  user_id uuid references public.profiles on delete set null,
  email text,
  product text,
  course_code text references public.courses on update cascade,
  amount_thb numeric(10, 2),
  status text not null,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.profiles     enable row level security;
alter table public.courses      enable row level security;
alter table public.enrolments   enable row level security;
alter table public.course_links enable row level security;
alter table public.resources    enable row level security;
alter table public.enquiries    enable row level security;
alter table public.payments     enable row level security;

-- profiles: see your own; the teacher sees everyone. You can edit your contact details but never your role.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_teacher());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, line_id) on public.profiles to authenticated;

-- courses: the class list is public.
drop policy if exists "courses read" on public.courses;
create policy "courses read" on public.courses for select to anon, authenticated using (true);
drop policy if exists "courses teacher write" on public.courses;
create policy "courses teacher write" on public.courses for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- enrolments: see your own; the teacher manages them.
drop policy if exists "enrolments read" on public.enrolments;
create policy "enrolments read" on public.enrolments for select to authenticated
  using (user_id = auth.uid() or public.is_teacher());
drop policy if exists "enrolments teacher write" on public.enrolments;
create policy "enrolments teacher write" on public.enrolments for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- lesson links: enrolled students and the teacher.
drop policy if exists "links read" on public.course_links;
create policy "links read" on public.course_links for select to authenticated
  using (public.is_teacher() or public.is_enrolled(course_code));
drop policy if exists "links teacher write" on public.course_links;
create policy "links teacher write" on public.course_links for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- resources: enrolled students and the teacher.
drop policy if exists "resources read" on public.resources;
create policy "resources read" on public.resources for select to authenticated
  using (public.is_teacher() or public.is_enrolled(course_code));
drop policy if exists "resources teacher write" on public.resources;
create policy "resources teacher write" on public.resources for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- enquiries: anyone can send one; only the teacher can read or update them.
drop policy if exists "enquiries insert" on public.enquiries;
create policy "enquiries insert" on public.enquiries for insert to anon, authenticated
  with check (status = 'new');
drop policy if exists "enquiries teacher read" on public.enquiries;
create policy "enquiries teacher read" on public.enquiries for select to authenticated
  using (public.is_teacher());
drop policy if exists "enquiries teacher update" on public.enquiries;
create policy "enquiries teacher update" on public.enquiries for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- payments: see your own; the teacher sees all. No insert policy, so only the server (service role) can write.
drop policy if exists "payments read" on public.payments;
create policy "payments read" on public.payments for select to authenticated
  using (user_id = auth.uid() or public.is_teacher());

-- ---------- Make yourself the teacher ----------
-- After you have created your own account on the website, run this once with your email:
-- update public.profiles set role = 'teacher' where email = 'you@example.com';
