-- 024_reports.sql — user reports on posts (W3 / App Store Guideline 1.2).
--
-- Guideline 1.2 requires a UGC app to ship, AT REVIEW, a mechanism for users to flag
-- objectionable content. This is that mechanism: a report is a row a signed-in user files
-- against a post they can see. Acting on reports (removing content within 24h, ejecting the
-- reporter's target) is out-of-band moderation over the service role — deliberately NOT a client
-- capability, so no policy here grants anyone the power to hide someone else's post. The app's
-- job is only to capture the flag.
--
-- Same shape as saves/ratings (005): own-row insert, gated to a post you can actually see, never
-- your own post, one report per (reporter, post). No anon — reporting needs an identity, exactly
-- as rating does.

create type report_reason as enum ('spam', 'nudity', 'violence', 'hate', 'other');

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references public.users (id) on delete cascade,
  reason      report_reason not null,
  note        text,
  created_at  timestamptz not null default now(),

  constraint reports_one_per_reporter unique (post_id, reporter_id),   -- one flag per person
  constraint reports_note_len check (note is null or char_length(note) between 1 and 500)
);

-- Moderation reads reports by post; index the hot column.
create index reports_post on public.reports (post_id);

alter table public.reports enable row level security;

-- A reporter can see their own reports (so the UI can reflect "already reported"); no one else
-- can — a report is not public reportage like a rating. Moderation uses the service role, which
-- bypasses RLS, so it needs no policy here.
create policy reports_own_read on public.reports
  for select using (reporter_id = auth.uid());

-- Filing a report: as yourself, only on a post you can see (blocks flagging an invisible post),
-- and never on your own post (you'd delete it, not flag it). The owner lookup only resolves for a
-- post the reporter can already see — exactly the posts we permit reporting.
create policy reports_insert on public.reports
  for insert with check (
    reporter_id = auth.uid()
    and public.can_view_post(post_id)
    and auth.uid() <> (select p.user_id from public.posts p where p.id = post_id)
  );

-- No update/delete policy: a flag is not retractable by the client (moderation owns the lifecycle).

grant select, insert on public.reports to authenticated;
