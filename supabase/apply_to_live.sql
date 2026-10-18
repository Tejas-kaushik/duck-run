-- Bring the LIVE Supabase project up to date with the repo's migrations (Tejas, 18 Oct).
-- Paste the whole file into Supabase > SQL Editor and press Run, once. Safe to run again: every step
-- checks first, so a step that's already applied is skipped. It runs as one transaction, so if
-- anything fails, nothing is changed.
--
-- Applies, after 20261017160000_rooms_players_attempts.sql (already live):
--   1. 20261017210000_race_rounds.sql          reset_room: the host can race again in the same room
--   2. 20261018000000_keep_attempts_on_leave.sql  leaving a reopened room keeps that player's results
--
-- The last query shows what's now live; you should see 1 row for reset_room and 2 for the constraints.

begin;

-- 1. reset_room (race_rounds) ------------------------------------------------------------------

create or replace function public.reset_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.id is null or not private.is_room_member(p_room_id) then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  if v_room.host_id <> v_uid then
    raise exception 'not_host' using errcode = '42501';
  end if;

  if v_room.status = 'started' then
    update public.rooms set status = 'waiting', start_at = null
    where id = p_room_id
    returning * into v_room;
  end if;

  return private.room_json(v_room);
end;
$$;

revoke all on function public.reset_room(uuid) from public, anon;
grant execute on function public.reset_room(uuid) to authenticated;

-- 2. Attempts survive a player leaving (keep_attempts_on_leave) --------------------------------

alter table public.attempts drop constraint if exists attempts_room_id_user_id_fkey;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.attempts'::regclass and conname = 'attempts_room_id_fkey') then
    alter table public.attempts
      add constraint attempts_room_id_fkey foreign key (room_id) references public.rooms (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.attempts'::regclass and conname = 'attempts_user_id_fkey') then
    alter table public.attempts
      add constraint attempts_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end;
$$;

commit;

-- Check ------------------------------------------------------------------------------------------

select 'function' as kind, p.proname as name
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'reset_room'
union all
select 'constraint', conname
from pg_constraint
where conrelid = 'public.attempts'::regclass and contype = 'f'
order by kind, name;
