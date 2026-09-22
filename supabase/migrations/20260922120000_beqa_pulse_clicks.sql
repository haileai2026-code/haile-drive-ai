-- BEQA pulse×click events. Numeric metrics only — never video/frames.

create table if not exists public.beqa_pulse_clicks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  student_id uuid references auth.users(id) on delete set null,
  clicked_at timestamptz not null default now(),
  bpm numeric,
  hrv numeric,
  signal_quality text check (signal_quality in ('none','low','medium','high')),
  reaction_ms integer,
  provider text not null default 'inhouse' check (provider in ('inhouse','binah')),
  created_at timestamptz not null default now()
);

create index if not exists beqa_pulse_clicks_student_idx
  on public.beqa_pulse_clicks (student_id, clicked_at desc);
create index if not exists beqa_pulse_clicks_session_idx
  on public.beqa_pulse_clicks (session_id);

alter table public.beqa_pulse_clicks enable row level security;

drop policy if exists "student insert own pulse clicks" on public.beqa_pulse_clicks;
create policy "student insert own pulse clicks"
  on public.beqa_pulse_clicks for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists "student read own pulse clicks" on public.beqa_pulse_clicks;
create policy "student read own pulse clicks"
  on public.beqa_pulse_clicks for select to authenticated
  using (
    student_id = auth.uid()
    or public.has_role(auth.uid(), 'owner')
  );
