-- Drawing Board schema. See the architecture plan for how the pieces relate.
-- Browsers read through row-level security; every write goes through the
-- Next.js API with the service role, which bypasses RLS.

-- One per phone browser: the anonymous Supabase user created on first visit.
create table public.devices (
  id uuid primary key references auth.users (id) on delete cascade,
  label text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Everyone in the "Who's drawing?" picker. Not tied to a phone, except that
-- only the device that created a person may edit them.
create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  signature_strokes jsonb not null,
  created_by_device_id uuid not null references public.devices (id),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

-- Who has drawn on which phone, for the picker's "On this phone" section.
create table public.device_people (
  device_id uuid not null references public.devices (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  last_selected_at timestamptz not null default now(),
  primary key (device_id, person_id)
);

-- A submitted drawing. Never changed after submit.
create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.people (id),
  device_id uuid not null references public.devices (id),
  strokes jsonb not null,
  sketch_path text not null,
  parent_drawing_id uuid references public.drawings (id),
  created_at timestamptz not null default now()
);

create type public.generation_status as enum ('pending', 'running', 'succeeded', 'failed');

-- One AI version of a drawing. A drawing can have many.
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.drawings (id) on delete cascade,
  preset_id text not null,
  preset_version integer not null,
  prompt text not null,
  model text not null,
  status public.generation_status not null default 'pending',
  image_path text,
  signed_path text,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- A physical frame. token_hash is the SHA-256 of the frame's bearer token.
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  panel_type text not null default 'spectra6-13in3',
  token_hash text not null unique,
  desired_rendition_id uuid,
  settings jsonb not null default '{
    "check_interval_s": 600,
    "fit": "cover",
    "palette": "ideal",
    "dither": "floyd",
    "contrast": 1,
    "saturation": 1
  }'::jsonb,
  shown_sha256 text,
  last_seen_at timestamptz,
  battery_mv integer,
  rssi integer,
  firmware text,
  created_at timestamptz not null default now()
);

-- An image converted for one panel type with one set of settings: the exact
-- file a frame downloads. generation_id is null for images sent by script.
create table public.renditions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid references public.generations (id) on delete set null,
  source_path text not null,
  panel_type text not null,
  settings_hash text not null,
  path text not null,
  sha256 text not null,
  bytes integer not null,
  created_at timestamptz not null default now(),
  unique (generation_id, panel_type, settings_hash)
);

alter table public.boards
  add constraint boards_desired_rendition_id_fkey
  foreign key (desired_rendition_id) references public.renditions (id);

-- Every "send to frame". shown_at is set when the frame reports showing it.
create table public.displays (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  rendition_id uuid not null references public.renditions (id),
  sent_by uuid references public.people (id),
  device_id uuid references public.devices (id),
  sent_at timestamptz not null default now(),
  shown_at timestamptz
);

-- One row per frame check-in, for the battery graph and debugging.
create table public.board_checkins (
  id bigint generated always as identity primary key,
  board_id uuid not null references public.boards (id) on delete cascade,
  at timestamptz not null default now(),
  battery_mv integer,
  rssi integer,
  firmware text,
  result text not null
);

create index people_last_active_idx on public.people (last_active_at desc);
create index drawings_created_idx on public.drawings (created_at desc);
create index drawings_artist_idx on public.drawings (artist_id);
create index generations_drawing_idx on public.generations (drawing_id);
create index displays_board_sent_idx on public.displays (board_id, sent_at desc);
create index board_checkins_board_at_idx on public.board_checkins (board_id, at desc);

-- ---------------------------------------------------------------- RLS
-- "authenticated" includes the anonymous per-phone sessions.

alter table public.devices enable row level security;
alter table public.people enable row level security;
alter table public.device_people enable row level security;
alter table public.drawings enable row level security;
alter table public.generations enable row level security;
alter table public.boards enable row level security;
alter table public.renditions enable row level security;
alter table public.displays enable row level security;
alter table public.board_checkins enable row level security;

create policy "Phones see their own device row" on public.devices
  for select to authenticated using (id = (select auth.uid()));

create policy "Everyone sees the people list" on public.people
  for select to authenticated using (true);

create policy "Phones see their own picker history" on public.device_people
  for select to authenticated using (device_id = (select auth.uid()));

create policy "Everyone sees the gallery" on public.drawings
  for select to authenticated using (true);

create policy "Everyone sees every version" on public.generations
  for select to authenticated using (true);

create policy "Everyone sees frame status" on public.boards
  for select to authenticated using (true);

create policy "Everyone sees frame history" on public.displays
  for select to authenticated using (true);

create policy "Everyone sees which renditions exist" on public.renditions
  for select to authenticated using (true);

-- board_checkins: no browser access.

-- Frame tokens never leave the server, even hashed.
revoke select on public.boards from anon, authenticated;
grant select (id, name, panel_type, desired_rendition_id, settings, shown_sha256,
              last_seen_at, battery_mv, rssi, firmware, created_at)
  on public.boards to authenticated;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public) values
  ('sketches', 'sketches', false),
  ('generations', 'generations', false),
  ('renditions', 'renditions', false);

create policy "Everyone can view sketches and posters" on storage.objects
  for select to authenticated using (bucket_id in ('sketches', 'generations'));

-- renditions: service role only; frames get short-lived signed links.
