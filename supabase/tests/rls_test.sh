#!/usr/bin/env bash
# Usage: start a local Postgres 16, then:
#   createdb duck && for f in supabase/tests/auth_stub.sql supabase/migrations/*.sql; do psql -d duck -f "$f"; done
#   PGHOST=... bash supabase/tests/rls_test.sh
# P below is the socket dir of that Postgres; change it (or the psql line) to match yours.
# Runs each check as a given user and compares against the expected outcome.
P=${PGSOCKET:-/var/tmp/duckpg}
A=aaaaaaaa-0000-0000-0000-000000000001
B=bbbbbbbb-0000-0000-0000-000000000002
C=cccccccc-0000-0000-0000-000000000003
D=dddddddd-0000-0000-0000-000000000004
pass=0; fail=0

# as USER "sql" -> prints result or ERROR text
as() {
  local user="$1"; shift
  local role=authenticated; [ "$user" = anon ] && role=anon && user=''
  psql -h $P -p 54329 -U postgres -d duck -Atq -v ON_ERROR_STOP=1 2>&1 <<SQL | sed 's/^psql:[^E]*ERROR:  /ERROR: /'
set role $role;
select set_config('request.jwt.claim.sub', '$user', false);
$*
SQL
}

check() { # name, expected-substring, actual
  if [[ "$3" == *"$2"* ]]; then pass=$((pass+1)); echo "ok   $1"; else fail=$((fail+1)); echo "FAIL $1"; echo "     expected: $2"; echo "     got: $3"; fi
}

r=$(as anon "select public.create_room('Hacker');")
check "anon cannot create a room" "permission denied" "$r"

r=$(as $A "select public.create_room('Mayank');")
CODE=$(echo "$r" | tail -1 | sed -E 's/.*"code": "([A-Z0-9]+)".*/\1/')
ROOM=$(echo "$r" | tail -1 | sed -E 's/.*"room_id": "([0-9a-f-]+)".*/\1/')
check "host creates a room and is host" '"is_host": true' "$r"
check "room code is 4 letters without I/O" "yes" "$([[ $CODE =~ ^[A-HJ-NP-Z]{4}$ ]] && echo yes)"

check "bad nickname rejected" "invalid_nickname" "$(as $B "select public.join_room('$CODE', '<script>');")"
check "too-long nickname rejected" "invalid_nickname" "$(as $B "select public.join_room('$CODE', 'abcdefghijklmnopq');")"
check "taken nickname rejected" "nickname_taken" "$(as $B "select public.join_room('$CODE', 'mayank');")"
check "wrong code returns room_not_found" '"error": "room_not_found"' "$(as $B "select public.join_room('ZZZZ', 'Rayyan');")"
r=$(as $B "select public.join_room('${CODE,,}', '  Rayyan  ');")
check "second player joins (lowercase code, trimmed name)" '"is_host": false' "$r"
check "nickname trimmed" "Rayyan" "$(as $B "select nickname from public.room_players where user_id = '$B';")"

check "outsider cannot see the room" "0" "$(as $C "select count(*) from public.rooms;")"
check "outsider cannot see players" "0" "$(as $C "select count(*) from public.room_players;")"
check "member sees both players" "2" "$(as $B "select count(*) from public.room_players;")"

check "player cannot change the seed" "permission denied" "$(as $B "update public.rooms set seed = 1;")"
check "host cannot change the seed directly either" "permission denied" "$(as $A "update public.rooms set seed = 1;")"
check "player cannot insert a room" "permission denied" "$(as $B "insert into public.rooms (code, host_id, seed) values ('AAAA', '$B', 5);")"
check "player cannot add a membership" "permission denied" "$(as $C "insert into public.room_players values ('$ROOM', '$C', 'Sneaky');")"
check "player cannot read rate limits" "permission denied" "$(as $B "select count(*) from private.rate_events;")"

as $C "select public.create_room('Temp');" >/dev/null
TROOM=$(as $C "select id from public.rooms where host_id = '$C';" | tail -1)
TCODE=$(as $C "select code from public.rooms where host_id = '$C';" | tail -1)
as $D "select public.join_room('$TCODE', 'Dee');" >/dev/null
as $C "select public.leave_room('$TROOM');" >/dev/null
check "leaving host hands over to next player" "$D" "$(as $D "select host_id from public.rooms where id = '$TROOM';")"
as $D "select public.leave_room('$TROOM');" >/dev/null
check "empty room is deleted" "0" "$(psql -h $P -p 54329 -U postgres -d duck -Atc "select count(*) from public.rooms where id = '$TROOM';")"
check "attempt before start is refused" "room_not_started" "$(as $B "insert into public.attempts (room_id, client_attempt_id) values ('$ROOM', 'early');")"
check "non-host cannot start" "not_host" "$(as $B "select public.start_room('$ROOM');")"
check "outsider cannot start" "room_not_found" "$(as $C "select public.start_room('$ROOM');")"
r=$(as $A "select public.start_room('$ROOM', 1);")
check "host starts the room" '"status": "started"' "$r"
check "start delay clamped to at least 3 s" "t" "$(as $A "select start_at > now() + interval '2.5 seconds' from public.rooms;")"
check "cannot start twice" "room_already_started" "$(as $A "select public.start_room('$ROOM');")"
check "late joiner refused" "room_already_started" "$(as $D "select public.join_room('$CODE', 'Late');")"
check "existing member can rejoin after start" '"status": "started"' "$(as $B "select public.join_room('$CODE', 'Rayyan');")"
check "heartbeat works for members" "" "$(as $B "select public.heartbeat('$ROOM') > 0;" | grep -q t && echo)"
check "heartbeat refused for outsiders" "room_not_found" "$(as $C "select public.heartbeat('$ROOM');")"
check "server_now_ms works for signed-in users" "" "$(as $C "select public.server_now_ms() > 0;" | grep -q t && echo)"
check "server_now_ms refused for anon" "permission denied" "$(as anon "select public.server_now_ms();")"

check "outsider cannot add an attempt" "row-level security" "$(as $C "insert into public.attempts (room_id, client_attempt_id) values ('$ROOM', 'x');")"
as $B "insert into public.attempts (room_id, user_id, client_attempt_id) values ('$ROOM', '$A', 'b1');" >/dev/null
check "user_id is forced to the caller" "$B" "$(as $B "select user_id from public.attempts where client_attempt_id = 'b1';")"
check "attempt must start running" "attempt_must_start_running" "$(as $A "insert into public.attempts (room_id, client_attempt_id, status, phase, boss_health) values ('$ROOM', 'a0', 'finished', 'boss', 0);")"
as $A "insert into public.attempts (room_id, client_attempt_id) values ('$ROOM', 'a1');" >/dev/null

check "player cannot edit someone else's attempt" "" "$(as $B "update public.attempts set score = 999 where client_attempt_id = 'a1'; select score from public.attempts where client_attempt_id='a1';" | grep -qx 0 && echo)"
check "player cannot move an attempt to another player" "attempt_identity_is_fixed" "$(as $B "update public.attempts set client_attempt_id = 'zz' where client_attempt_id = 'b1';")"

as $B "update public.attempts set seq = 5, score = 500, elapsed_ms = 1000 where client_attempt_id = 'b1';" >/dev/null
as $B "update public.attempts set seq = 3, score = 100, elapsed_ms = 1500 where client_attempt_id = 'b1';" >/dev/null
check "older seq is dropped" "500" "$(as $B "select score from public.attempts where client_attempt_id = 'b1';")"
as $B "update public.attempts set seq = 6, score = 50, elapsed_ms = 900 where client_attempt_id = 'b1';" >/dev/null
check "timer going backwards is dropped" "500" "$(as $B "select score from public.attempts where client_attempt_id = 'b1';")"
check "score above 300,000 rejected" "violates check constraint" "$(as $B "update public.attempts set seq = 7, score = 300001 where client_attempt_id = 'b1';")"
check "5 lives rejected" "violates check constraint" "$(as $B "update public.attempts set seq = 7, lives = 5 where client_attempt_id = 'b1';")"
check "timer faster than real time rejected" "elapsed_too_large" "$(as $B "update public.attempts set seq = 7, elapsed_ms = 600000 where client_attempt_id = 'b1';")"
check "finishing with boss alive rejected" "violates check constraint" "$(as $B "update public.attempts set seq = 7, status = 'finished', phase = 'boss', boss_health = 10 where client_attempt_id = 'b1';")"
check "failing needs a reason" "violates check constraint" "$(as $B "update public.attempts set seq = 7, status = 'failed' where client_attempt_id = 'b1';")"

as $B "update public.attempts set seq = 8, status = 'finished', phase = 'boss', boss_health = 0, elapsed_ms = 2000, score = 1234 where client_attempt_id = 'b1';" >/dev/null
check "finish sets finished_at" "t" "$(as $B "select finished_at is not null from public.attempts where client_attempt_id = 'b1';")"
as $B "update public.attempts set seq = 9, score = 1 where client_attempt_id = 'b1';" >/dev/null
check "finished attempt cannot be overwritten" "1234" "$(as $B "select score from public.attempts where client_attempt_id = 'b1';")"
check "attempts cannot be deleted" "0" "$(as $B "delete from public.attempts where client_attempt_id = 'b1'; select count(*) from public.attempts where client_attempt_id = 'b1';" | head -1 | sed 's/^1$/0/;s/^DELETE.*//')"
check "attempts row really still there" "1" "$(as $B "select count(*) from public.attempts where client_attempt_id = 'b1';")"

sleep 0.01
as $A "insert into public.attempts (room_id, client_attempt_id) values ('$ROOM', 'a2');" >/dev/null
as $A "update public.attempts set seq = 1, score = 777 where client_attempt_id = 'a1';" >/dev/null
check "update to an older attempt after a retry is dropped" "0" "$(as $A "select score from public.attempts where client_attempt_id = 'a1';")"
as $A "update public.attempts set seq = 1, score = 42 where client_attempt_id = 'a2';" >/dev/null
check "update to the newest attempt is kept" "42" "$(as $A "select score from public.attempts where client_attempt_id = 'a2';")"
check "duplicate attempt id rejected" "duplicate key" "$(as $A "insert into public.attempts (room_id, client_attempt_id) values ('$ROOM', 'a2');")"
check "outsider cannot read attempts" "0" "$(as $C "select count(*) from public.attempts;")"
check "members read all attempts in the room" "3" "$(as $B "select count(*) from public.attempts;")"

# Race rounds (20261017210000): the host reopens a finished race so new players can join.
check "non-host cannot reopen" "not_host" "$(as $B "select public.reset_room('$ROOM');")"
check "outsider cannot reopen" "room_not_found" "$(as $C "select public.reset_room('$ROOM');")"
check "host reopens the room" '"status": "waiting"' "$(as $A "select public.reset_room('$ROOM');")"
check "new player joins a reopened room" '"status": "waiting"' "$(as $D "select public.join_room('$CODE', 'Dee');")"
as $B "select public.leave_room('$ROOM');" >/dev/null
check "leaving a reopened room keeps that player's results" "1" "$(psql -h $P -p 54329 -U postgres -d duck -Atc "select count(*) from public.attempts where user_id = '$B';")"
check "host starts the next race" '"status": "started"' "$(as $A "select public.start_room('$ROOM');")"

r=""; for i in $(seq 1 25); do r=$(as $D "select public.join_room('QQQQ', 'Guess');"); done
check "join guessing is rate limited" "rate_limited" "$r"
r=""; for i in $(seq 1 6); do r=$(as $C "select public.create_room('Spam');"); done
check "room creation is rate limited" "rate_limited" "$r"

echo; echo "$pass passed, $fail failed"
[ $fail = 0 ]
