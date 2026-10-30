-- Studium on Supabase: its own project, Studium (ircgijvxzcxmcnyugdvm). Every table is named studium_*, so it can
-- share a project with Punctum later (Punctum's own tables are classes, images, packs, feedback, ...).
-- Run this whole file once in the SQL editor. It is safe to run again.
-- Auth: Google provider on (Authentication > Providers). Setup steps: docs/google-setup.md.

-- ---------- classes, students, plans, presence, notes ----------
create table if not exists studium_classes (
  code       text primary key check (code ~ '^[A-Z2-9]{6}$'),
  name       text not null,
  teacher    text,
  teacher_id uuid references auth.users(id) default auth.uid(),
  period     text,
  start      int,                         -- minutes after midnight
  created_at timestamptz default now()
);

create table if not exists studium_members (     -- a student in a class
  class_code text references studium_classes(code) on delete cascade,
  user_id    uuid references auth.users(id) default auth.uid(),
  name       text not null,
  email      text,
  joined_at  timestamptz default now(),
  primary key (class_code, user_id),
  unique (class_code, name)                -- notes find a student by name, so a name is never shared in a class
);

create table if not exists studium_plans (       -- one plan per class per day; body is the plan JSON from lesson.js
  class_code text references studium_classes(code) on delete cascade,
  date       date not null,
  body       jsonb not null,
  updated_at timestamptz default now(),
  primary key (class_code, date)
);

create table if not exists studium_presence (    -- where each student is, every 20 s
  class_code text references studium_classes(code) on delete cascade,
  student    text not null,
  user_id    uuid default auth.uid(),
  state      text, frames int, picks int, edits int,
  quest      jsonb,                       -- {tracked, title, step, f, done[], tally, by[], ach} from qSummary()
  seen_at    timestamptz default now(),
  primary key (class_code, student)
);

create table if not exists studium_notes (       -- teacher to student. "§tick:<quest>[:<step>]" is a quest tick, never shown
  id         bigint generated always as identity primary key,
  class_code text references studium_classes(code) on delete cascade,
  student    text not null,
  body       text not null,
  read_at    timestamptz,
  created_at timestamptz default now()
);

create table if not exists studium_feedback (    -- playtesters' answers on the demo's finish card
  id         bigint generated always as identity primary key,
  body       jsonb not null check (length(body::text) < 8000),
  created_at timestamptz default now()
);

-- ---------- the workbook, for the teacher's Google Slides decks ----------
-- Each workbook page is saved as a JPEG in the private "studium-workbooks" bucket at <user id>/<page id>.jpg.
-- pages = [{id, path, hash}] in workbook order.
create table if not exists studium_workbooks (
  user_id    uuid primary key references auth.users(id) default auth.uid(),
  class_code text references studium_classes(code) on delete set null,
  student    text,
  pages      jsonb not null default '[]',
  updated_at timestamptz default now()
);

-- Server-only tables (row level security on, no policies: only the studium-drive function can read them)
create table if not exists studium_teacher_google (   -- the Google account a teacher's decks go into
  teacher_id    uuid primary key references auth.users(id) on delete cascade,
  email         text,
  refresh_token text not null,
  root_folder   text,                                -- "Studium Workbooks" folder id
  connected_at  timestamptz default now()
);
create table if not exists studium_google_states (    -- one-time codes for the connect round trip
  state      text primary key,
  teacher_id uuid not null,
  back       text,                                   -- the Studium page to come back to
  created_at timestamptz default now()
);
create table if not exists studium_class_folders (    -- each class's folder inside "Studium Workbooks"
  class_code text primary key references studium_classes(code) on delete cascade,
  folder_id  text not null
);
create table if not exists studium_decks (            -- each student's deck
  user_id    uuid primary key references auth.users(id) on delete cascade,
  deck_id    text not null,
  built_hash text,
  built_at   timestamptz
);

alter table studium_classes        enable row level security;
alter table studium_members        enable row level security;
alter table studium_plans          enable row level security;
alter table studium_presence       enable row level security;
alter table studium_notes          enable row level security;
alter table studium_feedback       enable row level security;
alter table studium_workbooks      enable row level security;
alter table studium_teacher_google enable row level security;
alter table studium_google_states  enable row level security;
alter table studium_class_folders  enable row level security;
alter table studium_decks          enable row level security;

-- policies (dropped first so the file can be run again)
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' and tablename like 'studium\_%' loop
    execute format('drop policy %I on %I', r.policyname, r.tablename); end loop; end $$;

-- classes: only their teacher and their students see them. Joining looks one up by its exact code (studium_class_by_code)
create policy "teacher owns class"   on studium_classes  for all    using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "students see their class" on studium_classes for select using (exists (select 1 from studium_members m where m.class_code = studium_classes.code and m.user_id = auth.uid()));
create policy "join a class"         on studium_members  for insert with check (user_id = auth.uid());   -- no update: a name can't be changed to someone else's
create policy "see own membership"   on studium_members  for select using (user_id = auth.uid() or exists (select 1 from studium_classes c where c.code = class_code and c.teacher_id = auth.uid()));
create policy "class reads plan"     on studium_plans    for select using (exists (select 1 from studium_members m where m.class_code = studium_plans.class_code and m.user_id = auth.uid()) or exists (select 1 from studium_classes c where c.code = studium_plans.class_code and c.teacher_id = auth.uid()));
create policy "teacher writes plan"  on studium_plans    for all    using (exists (select 1 from studium_classes c where c.code = studium_plans.class_code and c.teacher_id = auth.uid()));
create policy "student writes self"  on studium_presence for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "teacher reads class"  on studium_presence for select using (exists (select 1 from studium_classes c where c.code = studium_presence.class_code and c.teacher_id = auth.uid()));
create policy "teacher writes notes" on studium_notes    for all    using (exists (select 1 from studium_classes c where c.code = studium_notes.class_code and c.teacher_id = auth.uid()));
create policy "student reads notes"  on studium_notes    for select using (exists (select 1 from studium_members m where m.class_code = studium_notes.class_code and m.user_id = auth.uid() and m.name = studium_notes.student));
create policy "anyone leaves feedback" on studium_feedback for insert with check (true);   -- the public demo has no login
create policy "own workbook"         on studium_workbooks for all   using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "teacher reads workbooks" on studium_workbooks for select using (exists (select 1 from studium_classes c where c.code = studium_workbooks.class_code and c.teacher_id = auth.uid()));

-- one class by its exact code, for the sign-in screen (never a list)
create or replace function studium_class_by_code(c text) returns table(code text, name text, teacher text, period text, start int)
  language sql security definer set search_path = public as $$
  select code, name, teacher, period, start from studium_classes where code = upper(c) and auth.role() = 'authenticated' limit 1;
$$;
grant execute on function studium_class_by_code(text) to authenticated;

-- achievement rarity: "% of your class has this". Returns only counts, never who.
create or replace function studium_ach_rarity(code text) returns table(id text, pct int) language sql security definer set search_path = public as $$
  with c as (select quest from studium_presence where class_code = code and quest ? 'ach'
         and exists (select 1 from studium_members m where m.class_code = code and m.user_id = auth.uid())),
       n as (select greatest(count(*),1) as total from c)
  select a.id, round(100.0 * count(*) / (select total from n))::int
  from c, jsonb_array_elements_text(c.quest->'ach'->'ids') as a(id)
  group by a.id;
$$;
grant execute on function studium_ach_rarity(text) to authenticated;

-- ---------- storage: workbook page images ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('studium-workbooks', 'studium-workbooks', false, 10485760, array['image/jpeg'])
  on conflict (id) do nothing;
drop policy if exists "studium: own workbook images" on storage.objects;
create policy "studium: own workbook images" on storage.objects for all to authenticated
  using (bucket_id = 'studium-workbooks' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'studium-workbooks' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- storage: each signed-in student's whole session (photos, edits, presets, boards, quests) ----------
-- <user id>/session.json plus one file per image at <user id>/i/<hash>.<ext>. Only the student can read or write their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('studium-saves', 'studium-saves', false, 26214400, array['image/jpeg','image/png','image/webp','application/json'])
  on conflict (id) do nothing;
drop policy if exists "studium: own saves" on storage.objects;
create policy "studium: own saves" on storage.objects for all to authenticated
  using (bucket_id = 'studium-saves' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'studium-saves' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- live: the Blades duel lobbies and each duel (src/duel.js), on Supabase Realtime ----------
-- Private channels only. studium-lobby:<class code> is for that class's students and teacher; studium-lobby:open is the
-- public demo's (any signed-in player); a duel's channel, studium-duel:<host id>:<guest id>, is only for those two.
create or replace function studium_may_live(t text) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when t = 'studium-lobby:open' then true
    when t like 'studium-lobby:%' then exists (select 1 from studium_members m where m.class_code = split_part(t, ':', 2) and m.user_id = auth.uid())
                                    or exists (select 1 from studium_classes c where c.code = split_part(t, ':', 2) and c.teacher_id = auth.uid())
    when t like 'studium-duel:%' then auth.uid()::text in (split_part(t, ':', 2), split_part(t, ':', 3))
    else false end;
$$;
grant execute on function studium_may_live(text) to authenticated;
drop policy if exists "studium: duel lobby and duels, read" on realtime.messages;
drop policy if exists "studium: duel lobby and duels, send" on realtime.messages;
create policy "studium: duel lobby and duels, read" on realtime.messages for select to authenticated
  using ( realtime.messages.extension in ('broadcast','presence') and studium_may_live(realtime.topic()) );
create policy "studium: duel lobby and duels, send" on realtime.messages for insert to authenticated
  with check ( realtime.messages.extension in ('broadcast','presence') and studium_may_live(realtime.topic()) );

-- ---------- trading: slabs and coins between players in the same lobby (src/lighttable/secret/market.js) ----------
-- A lobby is the same string the Blades duels use (studium-lobby:<class code>, or studium-lobby:open for the public demo),
-- and the same rule decides who may see it (studium_may_live above): a class trades only inside its class, the demo only
-- with the demo. Each player publishes their shelf (the slabs they have, no photos of their own, only the artist pack
-- prints the slabs are made from); an offer names what the sender gives and what they want, coins and slabs, and only
-- the two players can read it. The client holds the sender's side in escrow until the offer is accepted or ends.
create table if not exists studium_trade_shelves (
  user_id uuid primary key default auth.uid(),
  lobby text not null,
  name text not null,
  cards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists studium_trade_offers (
  id uuid primary key default gen_random_uuid(),
  lobby text not null,
  from_id uuid not null default auth.uid(),
  from_name text not null,
  to_id uuid not null,
  to_name text not null,
  give jsonb not null default '{}'::jsonb,
  want jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','accepted','declined','cancelled','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studium_trade_offers_to on studium_trade_offers (to_id, status);
create index if not exists studium_trade_offers_from on studium_trade_offers (from_id, status);
alter table studium_trade_shelves enable row level security;
alter table studium_trade_offers enable row level security;
drop policy if exists "trade: see shelves in my lobby" on studium_trade_shelves;
drop policy if exists "trade: my shelf" on studium_trade_shelves;
drop policy if exists "trade: see my offers" on studium_trade_offers;
drop policy if exists "trade: make an offer" on studium_trade_offers;
drop policy if exists "trade: answer my offers" on studium_trade_offers;
create policy "trade: see shelves in my lobby" on studium_trade_shelves for select to authenticated using (studium_may_live(lobby));
create policy "trade: my shelf" on studium_trade_shelves for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and studium_may_live(lobby));
create policy "trade: see my offers" on studium_trade_offers for select to authenticated using (auth.uid() in (from_id, to_id));
create policy "trade: make an offer" on studium_trade_offers for insert to authenticated
  with check (from_id = auth.uid() and to_id <> auth.uid() and status = 'open' and studium_may_live(lobby)
              and exists (select 1 from studium_trade_shelves s where s.user_id = studium_trade_offers.to_id and s.lobby = studium_trade_offers.lobby));
create policy "trade: answer my offers" on studium_trade_offers for update to authenticated using (auth.uid() in (from_id, to_id)) with check (auth.uid() in (from_id, to_id));
-- An offer's terms never change once sent: only its status (and updated_at), and only along these steps, each by the
-- right player: open to accepted or declined (the one it was sent to), open to cancelled (the sender), accepted to done
-- (the sender, once their side has landed). RLS can't compare a row before and after, so a trigger does.
revoke update on studium_trade_offers from authenticated, anon;
grant update (status, updated_at) on studium_trade_offers to authenticated;
create or replace function studium_trade_step() returns trigger language plpgsql as $$
begin
  if not ((old.status = 'open' and new.status in ('accepted', 'declined') and auth.uid() = old.to_id)
       or (old.status = 'open' and new.status = 'cancelled' and auth.uid() = old.from_id)
       or (old.status = 'accepted' and new.status = 'done' and auth.uid() = old.from_id)) then
    raise exception 'studium: that offer can''t change like that';
  end if;
  return new;
end $$;
drop trigger if exists studium_trade_step on studium_trade_offers;
create trigger studium_trade_step before update on studium_trade_offers for each row execute function studium_trade_step();
