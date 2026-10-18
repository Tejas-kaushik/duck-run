-- Race rounds (Tejas, multiplayer). Run after 20261017160000_rooms_players_attempts.sql.
--
-- A room can race more than once: after a race the host puts it back to 'waiting', so new players can
-- join and the host can start the next race. Attempts are kept; the client's leaderboard shows the
-- attempts created since the latest start (client/src/network/supabaseScoreboard.ts).
-- Players still finishing the last race keep updating their attempts: the attempt guard only needs a
-- started room for the INSERT, which happens at the start of the run.

create function public.reset_room(p_room_id uuid)
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
