-- Keep race results when a player leaves (Mayank). Run after 20261017210000_race_rounds.sql.
--
-- attempts pointed at room_players with on delete cascade. Since race rounds, a room goes back to
-- 'waiting' after each race, so leave_room deletes the membership and the cascade deleted that
-- player's finished attempts too. Attempts now hang off the room and the user instead; joining is
-- still required to add one (the "players start their own attempts" policy checks membership).

alter table public.attempts drop constraint attempts_room_id_user_id_fkey;

alter table public.attempts
  add constraint attempts_room_id_fkey foreign key (room_id) references public.rooms (id) on delete cascade,
  add constraint attempts_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
