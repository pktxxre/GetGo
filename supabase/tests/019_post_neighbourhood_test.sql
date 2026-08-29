-- pgTAP for 019_post_neighbourhood. The post's own location name exists, stays a short label,
-- and allows NULL (capturing location is optional).

begin;
select plan(4);

insert into auth.users (id, instance_id, email) values
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', '00000000-0000-0000-0000-000000000000', 'nbhd@getgo.test');

select has_column('public', 'posts', 'neighbourhood', 'posts has neighbourhood');

select lives_ok(
  $$ insert into public.posts (id, user_id, caption, neighbourhood)
     values ('f1000000-0000-0000-0000-000000000000',
             'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'ok', 'Shoreditch') $$,
  'a short neighbourhood name is accepted'
);
select is(
  (select neighbourhood from public.posts where id = 'f1000000-0000-0000-0000-000000000000'),
  'Shoreditch', 'the name is stored');
select throws_ok(
  $$ insert into public.posts (id, user_id, caption, neighbourhood)
     values ('f2000000-0000-0000-0000-000000000000',
             'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'bad', repeat('x', 61)) $$,
  '23514', null,
  'a neighbourhood over 60 chars is rejected (it is a label, not prose)'
);

select * from finish();
rollback;
