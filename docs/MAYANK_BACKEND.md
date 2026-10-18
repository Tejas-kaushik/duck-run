# Mayank: backend handoff

Mayank owns Supabase setup, security rules, room logic, the live scoreboard and deployment (TEAM_SPLIT, newest split). Rayyan owns the network code shared with the lobby, offline mode, progress updates, the course generator and the results screen.

## Done

- `supabase/migrations/20261017160000_rooms_players_attempts.sql`: tables `rooms`, `room_players` and `attempts`, row-level security, and the room functions.
- `supabase/migrations/20261017210000_race_rounds.sql` (Tejas): `reset_room`, so a room can race more than once.
- `supabase/migrations/20261018000000_keep_attempts_on_leave.sql`: leaving a reopened room no longer deletes that player's results.
- Run the migrations in filename order. The live project needs every one of them: the client calls `reset_room` to start a second race.
- `supabase/tests/`: 60 security checks that run against plain Postgres. Run them with `bash supabase/tests/rls_test.sh` (see the header of that file).
- `@supabase/supabase-js` is added to `client/package.json`. **Tejas owns that file, so get his OK before merging to `dev`.**

### Database functions (call with `supabase.rpc(name, args)`)

| Function | Args | Returns |
| --- | --- | --- |
| `create_room` | `p_nickname` | `{ room_id, code, seed, is_host, status, start_at_ms, server_now_ms }` |
| `join_room` | `p_code`, `p_nickname` | Same as above, or `{ error: 'room_not_found' }` |
| `start_room` | `p_room_id`, `p_delay_ms` (3000–15000, default 5000) | Same as above, with `start_at_ms` set |
| `leave_room` | `p_room_id` | Nothing. It only removes the player before the start, and hands host to the next player |
| `reset_room` | `p_room_id` | Host only. Puts a started room back to `waiting` for the next race. Same shape as `create_room` |
| `heartbeat` | `p_room_id` | Server time in ms. Call it every 5 s for presence |
| `server_now_ms` | none | Server time in ms, for clock-offset correction |

Errors are raised as exception messages: `not_signed_in`, `invalid_nickname`, `nickname_taken`, `room_already_started`, `room_full` (20 players), `not_host`, `rate_limited`, `room_not_started`.

Room codes are 4 letters with no I or O, the same as the lobby's local rooms.

### Attempts (Rayyan's `progress.ts` writes these)

- Insert `{ room_id, client_attempt_id: run.attemptId }` when an attempt starts. The room must already be started, and `user_id` is filled in by the server.
- Update with an increasing `seq` on every send: `phase`, `phase_progress` (0–1), `elapsed_ms`, `lives`, `oxygen`, `score`, `boss_health`, `status`, `fail_reason`.
- The server silently drops stale updates: a lower `seq`, a timer going backwards, an older attempt after a retry, or an attempt that has already finished. It rejects impossible values: score over 300,000, more than 4 lives, a timer faster than real time, finishing with the boss alive, or failing without a reason.

## Next steps

1. **Supabase project.** Create the project, turn on **Authentication → Allow anonymous sign-ins**, then paste the migration into the SQL Editor and run it. Share only the project URL and the anon (publishable) key. Never share or commit the service-role or secret key.
2. **`client/src/network/supabase.ts`.** Create the client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and sign in anonymously with `signInAnonymously()` if there's no session. Store the session in `sessionStorage`, so two tabs act as two players during testing. Refuse to start if the key looks like a secret key.
3. **`client/src/network/supabaseRooms.ts`.** Implement `RoomApi` from `client/src/network/types.ts`, which is Tejas's version. Use the RPCs above, Realtime `postgres_changes` on `room_players` and `rooms` filtered by room id, clock-offset correction for `onStart`, and a 5 s heartbeat. Map error codes to readable messages, because the lobby shows `Error.message` as-is. Tejas swaps it in for `localRooms` in `main.ts`.
4. **Live scoreboard.** Write a pure ranking function and test it: players with a completed run are ranked by fastest time, with score as the tie-breaker. Everyone else is ranked by section, then progress, where boss progress is the share of health removed. A player is marked disconnected after 15 s without contact. Then build `client/src/ui/scoreboard.ts`, fed by Realtime on `attempts`.
5. **Deploy on Vercel.** Import the repo, set the root directory to `client`, use the Vite preset, and add the two `VITE_` environment variables. Add `.env.local` to `.gitignore`.

## Team decisions still open (DUCK_RUN_ADDENDUM)

Boss Space during Ready/Aim, Space held at reload entry, Ready/Aim/Fire timings, the damage formula, how bullets aim, and how the 300,000 score is split. These are placeholders in `client/src/core/config.ts`. Decide them as a team; don't let an AI pick them.
