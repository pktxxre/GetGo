-- 001_users.sql — public.users, a mirror of auth.users (CLAUDE.md → Data model).
--
-- `users` is keyed to the same uuid as auth.users and populated by a trigger on signup.
-- `handle` is user-chosen, so it can't exist at trigger time — it is NULL until an
-- onboarding screen claims it (decision C6). RLS ships in this same migration; a table
-- without policies is a bug.

create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        text unique,              -- NULL until onboarding claims it (C6)
  bio           text,
  avatar_path   text,
  tombstoned_at timestamptz,              -- soft-delete marker; see delete_account (later)
  created_at    timestamptz not null default now()
);

alter table public.users enable row level security;

-- Anyone (incl. anon) may read live profiles. Tombstoned accounts disappear from reads
-- so one user's deletion can't leave a dangling byline on another user's history.
create policy users_public_read on public.users
  for select using (tombstoned_at is null);

-- A user may only edit their own row. WITH CHECK stops an UPDATE from re-homing the row
-- onto someone else's id.
create policy users_self_write on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- No INSERT policy on purpose: rows are created only by the trigger below, which runs
-- SECURITY DEFINER. A client can never insert a users row directly.

-- Table-level privileges. RLS decides *which rows*; a GRANT decides *whether the role can
-- touch the table at all*. Both are required — a policy without a grant is "permission
-- denied for table". anon reads live profiles (cold web visitors see bylines);
-- authenticated additionally updates, gated to its own row by users_self_write. No INSERT
-- grant: the trigger owns creation. No DELETE grant: teardown goes through delete_account.
grant select on public.users to anon, authenticated;
grant update on public.users to authenticated;

-- Mirror trigger. SECURITY DEFINER so it can write public.users regardless of the caller;
-- `set search_path = ''` is mandatory on every SECURITY DEFINER function — without it the
-- function is a privilege-escalation vector (all object names are therefore schema-qualified).
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;   -- idempotent: a re-fired trigger must be a no-op, not an error
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
