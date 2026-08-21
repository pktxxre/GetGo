-- 010_handle_format.sql — the shape of a claimed handle is decided in Postgres, not the client.
--
-- `handle` stays NULL until onboarding claims it (001, decision C6). Once set, RLS lets a user
-- write their own row (users_self_write), so the *format* of a handle can't be trusted to the
-- client — a hand-rolled PostgREST call could set it to anything. This CHECK is the real guard;
-- the AuthSheet's inline validation is only there to spare a round-trip.
--
-- Rule: 3–20 chars of lowercase letters, digits, or underscore. Lowercase-only makes the
-- existing UNIQUE index effectively case-insensitive (the client normalises before writing),
-- so `Mara` and `mara` can't both exist. NULL is still allowed — the constraint only bites once
-- a handle is claimed.
alter table public.users
  add constraint users_handle_format
  check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');
