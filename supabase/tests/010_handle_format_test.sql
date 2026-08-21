-- pgTAP for 010_handle_format. Run with `supabase test db` (local stack, real roles).
-- The handle CHECK is the server-side guard behind the onboarding claim: a valid handle
-- lands, anything malformed is rejected regardless of the client, and NULL stays legal.

begin;
select plan(8);

\set uid '31313131-3131-3131-3131-313131313131'

-- shape
select has_column('public', 'users', 'handle', 'users.handle exists');
select col_has_check('public', 'users', 'handle', 'handle carries a CHECK constraint');

-- a signup row starts with a NULL handle (constraint permits it)
insert into auth.users (id, instance_id, email)
values ('31313131-3131-3131-3131-313131313131',
        '00000000-0000-0000-0000-000000000000', 'handle@getgo.test');
select is(
  (select handle from public.users where id = :'uid'),
  null,
  'NULL handle is allowed before a claim'
);

-- a well-formed handle is accepted
select lives_ok(
  $$ update public.users set handle = 'scenic_route7' where id = '31313131-3131-3131-3131-313131313131' $$,
  'a lowercase alphanumeric handle is accepted'
);

-- malformed handles are rejected by the CHECK (23514), not silently stored
select throws_ok(
  $$ update public.users set handle = 'ab' where id = '31313131-3131-3131-3131-313131313131' $$,
  '23514', null, 'too short (< 3) is rejected'
);
select throws_ok(
  $$ update public.users set handle = 'Mara' where id = '31313131-3131-3131-3131-313131313131' $$,
  '23514', null, 'uppercase is rejected (keeps UNIQUE case-insensitive)'
);
select throws_ok(
  $$ update public.users set handle = 'has-dash' where id = '31313131-3131-3131-3131-313131313131' $$,
  '23514', null, 'punctuation other than underscore is rejected'
);
select throws_ok(
  $$ update public.users set handle = 'this_handle_is_way_too_long' where id = '31313131-3131-3131-3131-313131313131' $$,
  '23514', null, 'over 20 chars is rejected'
);

select * from finish();
rollback;
