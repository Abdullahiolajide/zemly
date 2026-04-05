-- Persist generated podcast scripts + audio path per note

create table if not exists public.podcast_sessions (
    id bigserial primary key,
    note_id bigint not null references public.notes(id) on delete cascade,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    script jsonb,
    audio_path text,
    audio_mime_type text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (note_id)
);

alter table public.podcast_sessions enable row level security;

drop policy if exists "podcast_sessions_select_own" on public.podcast_sessions;
create policy "podcast_sessions_select_own"
on public.podcast_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "podcast_sessions_insert_own" on public.podcast_sessions;
create policy "podcast_sessions_insert_own"
on public.podcast_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "podcast_sessions_update_own" on public.podcast_sessions;
create policy "podcast_sessions_update_own"
on public.podcast_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "podcast_sessions_delete_own" on public.podcast_sessions;
create policy "podcast_sessions_delete_own"
on public.podcast_sessions
for delete
using (auth.uid() = user_id);

create index if not exists podcast_sessions_note_id_idx on public.podcast_sessions(note_id);
create index if not exists podcast_sessions_user_id_idx on public.podcast_sessions(user_id);

create or replace function public.set_podcast_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_podcast_sessions_updated_at on public.podcast_sessions;
create trigger set_podcast_sessions_updated_at
before update on public.podcast_sessions
for each row
execute function public.set_podcast_sessions_updated_at();
