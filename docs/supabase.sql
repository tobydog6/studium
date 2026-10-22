-- Studium + Punctum on Supabase (project region: ap-southeast-2, Sydney).
-- Run in the SQL editor of a new project, then set window.STUDIUM_SUPABASE = {url, anonKey} in the build.
-- Auth: enable Google and Azure (Microsoft) providers; restrict sign-ups to the school's domains.

create table if not exists classes (
  code       text primary key check (code ~ '^[A-Z2-9]{6}$'),
  name       text not null,
  teacher    text,
  teacher_id uuid references auth.users(id) default auth.uid(),
  period     text,
  start      int,                         -- minutes after midnight
  created_at timestamptz default now()
);

create table if not exists members (     -- a student in a class
  class_code text references classes(code) on delete cascade,
  user_id    uuid references auth.users(id) default auth.uid(),
  name       text not null,
  primary key (class_code, user_id)
);

create table if not exists plans (       -- one plan per class per day; body is the plan JSON from lesson.js
  class_code text references classes(code) on delete cascade,
  date       date not null,
  body       jsonb not null,
  updated_at timestamptz default now(),
  primary key (class_code, date)
);

create table if not exists presence (    -- where each student is, every 20 s
  class_code text references classes(code) on delete cascade,
  student    text not null,
  user_id    uuid default auth.uid(),
  state      text, frames int, picks int, edits int,
  quest      jsonb,                       -- {tracked, title, step, f, done[], tally, by[]} from qSummary()
  seen_at    timestamptz default now(),
  primary key (class_code, student)
);

create table if not exists notes (       -- teacher to student
  id         bigint generated always as identity primary key,
  class_code text references classes(code) on delete cascade,
  student    text not null,
  body       text not null,
  read_at    timestamptz,
  created_at timestamptz default now()
);

alter table classes  enable row level security;
alter table members  enable row level security;
alter table plans    enable row level security;
alter table presence enable row level security;
alter table notes    enable row level security;

-- anyone signed in can look a class up by its code (that's how joining works); only its teacher changes it
create policy "read class by code"   on classes for select using (auth.role() = 'authenticated');
create policy "teacher owns class"   on classes for all    using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "join a class"         on members for insert with check (user_id = auth.uid());
create policy "see own membership"   on members for select using (user_id = auth.uid() or exists (select 1 from classes c where c.code = class_code and c.teacher_id = auth.uid()));
create policy "class reads plan"     on plans   for select using (exists (select 1 from members m where m.class_code = plans.class_code and m.user_id = auth.uid()) or exists (select 1 from classes c where c.code = plans.class_code and c.teacher_id = auth.uid()));
create policy "teacher writes plan"  on plans   for all    using (exists (select 1 from classes c where c.code = plans.class_code and c.teacher_id = auth.uid()));
create policy "student writes self"  on presence for all   using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "teacher reads class"  on presence for select using (exists (select 1 from classes c where c.code = presence.class_code and c.teacher_id = auth.uid()));
create policy "teacher writes notes" on notes   for all    using (exists (select 1 from classes c where c.code = notes.class_code and c.teacher_id = auth.uid()));
create policy "student reads notes"  on notes   for select using (exists (select 1 from members m where m.class_code = notes.class_code and m.user_id = auth.uid() and m.name = notes.student));

-- quests (added with the quest system). Run on an existing project:
alter table presence add column if not exists quest jsonb;
-- A teacher ticking a quest off for a student is a note whose body is "§tick:<quest id>" or "§tick:<quest id>:<step>".
-- The student's app applies it once and never shows it. Class checkpoint dates ride on the plan body as "cps".
