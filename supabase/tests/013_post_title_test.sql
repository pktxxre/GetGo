-- pgTAP for 013_post_title. Run with `supabase test db`.
-- posts.title exists, is nullable, and the length CHECK bounds it to 1..80 chars.

begin;
select plan(5);

\set uid '71717171-7171-7171-7171-717171717171'

select has_column('public', 'posts', 'title', 'posts.title exists');
select col_is_null('public', 'posts', 'title', 'posts.title is nullable (naming is optional)');

insert into auth.users (id, instance_id, email)
values ('71717171-7171-7171-7171-717171717171', '00000000-0000-0000-0000-000000000000', 'titler@getgo.test');

select lives_ok(
  $$ insert into public.posts (id, user_id, title)
     values ('d1000000-0000-0000-0000-000000000000', '71717171-7171-7171-7171-717171717171', 'swim the ponds at dawn') $$,
  'a 1..80 char title is accepted'
);
select throws_ok(
  $$ insert into public.posts (id, user_id, title)
     values ('d2000000-0000-0000-0000-000000000000', '71717171-7171-7171-7171-717171717171', '') $$,
  '23514', null, 'an empty title is rejected'
);
select throws_ok(
  $$ insert into public.posts (id, user_id, title)
     values ('d3000000-0000-0000-0000-000000000000', '71717171-7171-7171-7171-717171717171', repeat('x', 81)) $$,
  '23514', null, 'over 80 chars is rejected'
);

select * from finish();
rollback;
