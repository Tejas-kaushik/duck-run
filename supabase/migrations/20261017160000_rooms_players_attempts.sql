-- Duck Run backend (Mayank). Rooms, players, attempts, row-level security and the room functions.
-- Brief §12 + TEAM_SPLIT. Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Who can do what:
--   * Everyone signs in anonymously (Supabase "Allow anonymous sign-ins" must be ON).
--   * Rooms and memberships are only created/changed through the functions below, so a player
--     can't make themselves host, change the seed, or start someone else's room.
--   * Room members can read their own room, its players and its attempts. Nobody can read a room
--     they haven't joined, so room codes can't be listed.
--   * A player can only insert/update their own attempts. A trigger drops stale updates
--     (older seq, an older attempt, or an attempt that already finished/failed) and rejects
--     impossible values.
--
-- Client-reported scores are NOT cheat-proof (brief §12). These checks only stop obvious nonsense.

create schema if not exists private;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.rooms (
  id           uuid primary key default gen_random_uuid(),
  -- 4 letters, no I or O, matching the lobby (client/src/network/localRooms.ts).
  code         text not null unique check (code ~ '^[A-HJ-NP-Z]{4}$'),
  host_id      uuid not null references auth.users (id) on delete cascade,
  seed         integer not null check (seed > 0),
  game_version text not null default 'duck-run-1',
  status       text not null default 'waiting' check (status in ('waiting', 'started')),
  start_at     timestamptz,
  created_at   timestamptz not null default now(),
  check ((status = 'started') = (start_at is not null))
);

create table public.room_players (
  room_id      uuid not null references public.rooms (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  nickname     text not null check (char_length(nickname) between 1 and 16),
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Two players in one room can't both be "Duck".
create unique index room_players_nickname_per_room on public.room_players (room_id, lower(nickname));

create table public.attempts (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null,
  user_id           uuid not null default auth.uid(),
  -- RunState.attemptId from the game (core/Game.ts makes it). Unique per player per room.
  client_attempt_id text not null check (char_length(client_attempt_id) between 1 and 64),
  -- Increases with every update the client sends; older updates are dropped.
  seq               integer not null default 0 check (seq >= 0),
  status            text not null default 'running' check (status in ('running', 'failed', 'finished')),
  phase             text not null default 'runner1' check (phase in ('runner1', 'underwater', 'runner2', 'boss')),
  -- phaseDistance / phaseLength, 0..1.
  phase_progress    real not null default 0 check (phase_progress between 0 and 1),
  elapsed_ms        integer not null default 0 check (elapsed_ms between 0 and 3600000),
  lives             smallint not null default 3 check (lives between 0 and 4),
  oxygen            smallint not null default 3 check (oxygen between 0 and 3),
  score             integer not null default 0 check (score between 0 and 300000),
  boss_health       integer not null default 30000 check (boss_health between 0 and 30000),
  fail_reason       text check (fail_reason in ('lives', 'oxygen')),
  created_at        timestamptz not null default now(),
  -- Server estimate of when this attempt's timer started (created_at minus the elapsed_ms sent
  -- with the first insert). Used only to reject timers that run faster than real time.
  clock_start_at    timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  finished_at       timestamptz,
  unique (room_id, user_id, client_attempt_id),
  foreign key (room_id, user_id) references public.room_players (room_id, user_id) on delete cascade,
  check ((status = 'failed') = (fail_reason is not null)),
  check (status <> 'finished' or (phase = 'boss' and boss_health = 0))
);

create index attempts_room_user_latest on public.attempts (room_id, user_id, created_at desc);

-- Rate limiting for the room functions (create/join), so codes can't be brute-forced.
create table private.rate_events (
  user_id uuid not null,
  kind    text not null,
  at      timestamptz not null default now()
);
create index rate_events_lookup on private.rate_events (user_id, kind, at desc);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

create function private.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players rp
    where rp.room_id = p_room_id and rp.user_id = auth.uid()
  );
$$;

create function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- Trims, collapses spaces, then allows 1–16 letters, digits, spaces, _ . -
create function private.clean_nickname(p_nickname text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g');
begin
  if char_length(v) < 1 or char_length(v) > 16 or v !~ '^[A-Za-z0-9 _.\-]+$' then
    raise exception 'invalid_nickname' using errcode = '22023';
  end if;
  return v;
end;
$$;

create function private.rate_limit(p_kind text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if (select count(*) from private.rate_events
      where user_id = v_uid and kind = p_kind and at > now() - p_window) >= p_max then
    raise exception 'rate_limited' using errcode = '53400';
  end if;
  insert into private.rate_events (user_id, kind) values (v_uid, p_kind);
end;
$$;

create function private.now_ms()
returns bigint
language sql
volatile
set search_path = ''
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

create function private.ts_ms(p_ts timestamptz)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select floor(extract(epoch from p_ts) * 1000)::bigint;
$$;

create function private.room_json(p_room public.rooms)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'room_id', p_room.id,
    'code', p_room.code,
    'seed', p_room.seed,
    'game_version', p_room.game_version,
    'is_host', p_room.host_id = auth.uid(),
    'status', p_room.status,
    'start_at_ms', case when p_room.start_at is null then null else private.ts_ms(p_room.start_at) end,
    'server_now_ms', private.now_ms()
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Room functions (the only way to create, join or start a room)
-- ---------------------------------------------------------------------------------------------

create function public.create_room(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_nickname text := private.clean_nickname(p_nickname);
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code     text;
  v_room     public.rooms;
begin
  perform private.rate_limit('create_room', 5, interval '10 minutes');

  for i in 1..20 loop
    v_code := '';
    for j in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 24)::int, 1);
    end loop;
    begin
      insert into public.rooms (code, host_id, seed)
      values (v_code, v_uid, 1 + floor(random() * 2147483646)::int)
      returning * into v_room;
      exit;
    exception when unique_violation then
      v_room := null; -- code taken, try another
    end;
  end loop;

  if v_room.id is null then
    raise exception 'could_not_create_room' using errcode = '53400';
  end if;

  insert into public.room_players (room_id, user_id, nickname) values (v_room.id, v_uid, v_nickname);
  return private.room_json(v_room);
end;
$$;

create function public.join_room(p_code text, p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_nickname text := private.clean_nickname(p_nickname);
  v_room     public.rooms;
begin
  perform private.rate_limit('join_room', 20, interval '1 minute');

  select * into v_room from public.rooms where code = upper(btrim(coalesce(p_code, '')));
  if v_room.id is null then
    -- Returned, not raised: raising would roll back the rate-limit row above, and then wrong
    -- codes could be guessed forever.
    return jsonb_build_object('error', 'room_not_found');
  end if;

  if exists (select 1 from public.room_players where room_id = v_room.id and user_id = v_uid) then
    -- Rejoining (e.g. after a page refresh) keeps the membership; the nickname can change.
    begin
      update public.room_players set nickname = v_nickname, last_seen_at = now()
      where room_id = v_room.id and user_id = v_uid;
    exception when unique_violation then
      raise exception 'nickname_taken' using errcode = '23505';
    end;
    return private.room_json(v_room);
  end if;

  -- MVP: late joiners wait for a new challenge (brief §12), so a started room is closed.
  if v_room.status <> 'waiting' then
    raise exception 'room_already_started' using errcode = '55000';
  end if;

  if (select count(*) from public.room_players where room_id = v_room.id) >= 20 then
    raise exception 'room_full' using errcode = '53300';
  end if;

  begin
    insert into public.room_players (room_id, user_id, nickname) values (v_room.id, v_uid, v_nickname);
  exception when unique_violation then
    raise exception 'nickname_taken' using errcode = '23505';
  end;

  return private.room_json(v_room);
end;
$$;

-- Host only. Schedules the shared start a few seconds ahead so every client can count down to it.
create function public.start_room(p_room_id uuid, p_delay_ms integer default 5000)
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
  if v_room.status <> 'waiting' then
    raise exception 'room_already_started' using errcode = '55000';
  end if;

  update public.rooms
  set status = 'started',
      start_at = clock_timestamp() + make_interval(secs => greatest(3000, least(15000, coalesce(p_delay_ms, 5000))) / 1000.0)
  where id = p_room_id
  returning * into v_room;

  return private.room_json(v_room);
end;
$$;

-- Leaving. Before the start, the player is removed (a leaving host hands over to the earliest
-- joiner; an empty room is deleted). After the start the membership is kept so results survive.
create function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_room     public.rooms;
  v_new_host uuid;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.id is null or v_room.status <> 'waiting' then
    return;
  end if;

  delete from public.room_players where room_id = p_room_id and user_id = v_uid;

  if v_room.host_id = v_uid then
    select user_id into v_new_host from public.room_players
    where room_id = p_room_id order by joined_at, user_id limit 1;
    if v_new_host is null then
      delete from public.rooms where id = p_room_id;
    else
      update public.rooms set host_id = v_new_host where id = p_room_id;
    end if;
  end if;
end;
$$;

-- Presence: call every few seconds while in a room. Also returns the server clock.
create function public.heartbeat(p_room_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  update public.room_players set last_seen_at = now()
  where room_id = p_room_id and user_id = v_uid;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  return private.now_ms();
end;
$$;

-- For clock-offset correction before a room exists.
create function public.server_now_ms()
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  select private.now_ms();
$$;

-- ---------------------------------------------------------------------------------------------
-- Attempt guard: drops stale updates, blocks tampering and impossible values
-- ---------------------------------------------------------------------------------------------

create function private.guard_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  if tg_op = 'INSERT' then
    new.user_id    := auth.uid();
    new.created_at := now();
    new.clock_start_at := now() - make_interval(secs => new.elapsed_ms / 1000.0);
    new.updated_at := now();
    new.finished_at := null;

    select * into v_room from public.rooms where id = new.room_id;
    if v_room.id is null or v_room.status <> 'started' then
      raise exception 'room_not_started' using errcode = '55000';
    end if;
    if new.status <> 'running' then
      raise exception 'attempt_must_start_running' using errcode = '22023';
    end if;
    if (select count(*) from public.attempts where room_id = new.room_id and user_id = new.user_id) >= 300 then
      raise exception 'rate_limited' using errcode = '53400';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.id <> old.id or new.room_id <> old.room_id or new.user_id <> old.user_id
     or new.client_attempt_id <> old.client_attempt_id or new.created_at <> old.created_at
     or new.clock_start_at <> old.clock_start_at then
    raise exception 'attempt_identity_is_fixed' using errcode = '42501';
  end if;

  -- Silently drop (return null) anything that isn't the newest state of the newest attempt.
  if old.status <> 'running' then
    return null; -- already finished/failed: keep the completed record
  end if;
  if new.seq <= old.seq or new.elapsed_ms < old.elapsed_ms then
    return null; -- out-of-order or duplicate update
  end if;
  if exists (
    select 1 from public.attempts a
    where a.room_id = old.room_id and a.user_id = old.user_id and a.created_at > old.created_at
  ) then
    return null; -- the player has already retried; this attempt is history
  end if;

  -- The run timer can't be ahead of real time (5 s of slack for clock jitter).
  if new.elapsed_ms > extract(epoch from (now() - old.clock_start_at)) * 1000 + 5000 then
    raise exception 'elapsed_too_large' using errcode = '22023';
  end if;

  new.updated_at := now();
  if new.status <> 'running' then
    new.finished_at := now();
  end if;
  return new;
end;
$$;

create trigger attempts_guard
before insert or update on public.attempts
for each row execute function private.guard_attempt();

-- ---------------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------------

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.attempts enable row level security;

create policy "members read their room" on public.rooms
  for select to authenticated using (private.is_room_member(id));

create policy "members read players in their room" on public.room_players
  for select to authenticated using (private.is_room_member(room_id));

create policy "members read attempts in their room" on public.attempts
  for select to authenticated using (private.is_room_member(room_id));

create policy "players start their own attempts" on public.attempts
  for insert to authenticated
  with check (user_id = auth.uid() and private.is_room_member(room_id));

create policy "players update their own attempts" on public.attempts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No delete policies anywhere: completed records are kept (brief §12).
-- Rooms and memberships have no insert/update policies: the functions above are the only way in.

-- ---------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------

revoke all on public.rooms, public.room_players, public.attempts from anon, public;
revoke insert, update, delete on public.rooms, public.room_players from authenticated;
grant select on public.rooms, public.room_players to authenticated;
grant select, insert, update on public.attempts to authenticated;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.is_room_member(uuid) to authenticated;
revoke all on private.rate_events from public, authenticated;

revoke all on function public.create_room(text), public.join_room(text, text),
  public.start_room(uuid, integer), public.leave_room(uuid), public.heartbeat(uuid),
  public.server_now_ms() from public, anon;
grant execute on function public.create_room(text), public.join_room(text, text),
  public.start_room(uuid, integer), public.leave_room(uuid), public.heartbeat(uuid),
  public.server_now_ms() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime (the live scoreboard and lobby listen to these tables; RLS still applies)
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rooms, public.room_players, public.attempts;
  end if;
end;
$$;
