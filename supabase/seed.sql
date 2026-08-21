-- seed.sql — development fixtures. Runs after migrations on `supabase db reset`
-- (config.toml → [db.seed]). NOT production data and NOT the curated launch catalog — it
-- exists so the feed (T12) has something real to render through RLS while the post-creation
-- flow and auth are still being built.
--
-- Why direct inserts and not create_post(): create_post is SECURITY DEFINER and keys off
-- auth.uid(), so it only runs inside a signed-in request — there is no session in a seed
-- script. create_post's own logic (ordinal stamping, the flat XP row) is already covered by
-- pgTAP; this file just needs fixture rows, so it stamps completion_ordinal by hand. Seed
-- runs as the table owner, which bypasses RLS — that is expected for fixtures.
--
-- Photos: storage_path holds a full https URL (stable picsum seeds) rather than a bucket
-- object key. lib/photos.ts passes an http(s) path straight through and only calls
-- getPublicUrl() for real object keys, so this is forward-compatible with real uploads. The
-- width/height are the true picsum dimensions so the masonry reserves geometry and never
-- reflows (DESIGN.md → Motion; migration 008).

-- ── demo authors (the trigger mirrors auth.users → public.users) ────────────────
insert into auth.users (id, instance_id, email) values
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'mara@getgo.test'),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'theo@getgo.test'),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'priya@getgo.test');

update public.users set handle = 'mara'  where id = 'd0000000-0000-0000-0000-000000000001';
update public.users set handle = 'theo'  where id = 'd0000000-0000-0000-0000-000000000002';
update public.users set handle = 'priya' where id = 'd0000000-0000-0000-0000-000000000003';

-- ── curated quest catalog (origin='curated', authorless) ────────────────────────
-- effort/nerve are 1..3 tiers (client maps to low/mid/high); cost_pence is pennies, 0=free.
insert into public.quest_templates
  (id, slug, title, neighbourhood, origin, effort, nerve, cost_pence) values
  ('70000000-0000-0000-0000-000000000001', 'eel-pie-island',       'sneak onto eel pie island',              'Twickenham',   'curated', 2, 3,   0),
  ('70000000-0000-0000-0000-000000000002', 'kyoto-garden-herons',  'find the herons in kyoto garden',        'Holland Park',  'curated', 1, 1,   0),
  ('70000000-0000-0000-0000-000000000003', 'gods-own-junkyard',    'get lost in a room made of neon',        'Walthamstow',   'curated', 1, 1,   0),
  ('70000000-0000-0000-0000-000000000004', 'leake-street-tunnel',  'add a line to the leake street tunnel',  'Waterloo',      'curated', 2, 2, 300),
  ('70000000-0000-0000-0000-000000000005', 'nunhead-cemetery',     'find the ruined chapel in the woods',    'Nunhead',       'curated', 2, 2,   0),
  ('70000000-0000-0000-0000-000000000006', 'phone-box-library',    'borrow a book from a phone box',         'Lewisham',      'curated', 1, 1,   0),
  ('70000000-0000-0000-0000-000000000007', 'daunt-books-balcony',  'read on the daunt books balcony',        'Marylebone',    'curated', 1, 1,   0),
  ('70000000-0000-0000-0000-000000000008', 'thames-mudlark',       'mudlark the thames at low tide',         'Rotherhithe',   'curated', 2, 2,   0),
  ('70000000-0000-0000-0000-000000000009', 'hampstead-ponds',      'swim the mixed pond at dawn',            'Hampstead',     'curated', 2, 3, 420),
  ('70000000-0000-0000-0000-00000000000a', 'brick-lane-bagel-2am', 'eat a beigel at 2am',                    'Shoreditch',    'curated', 1, 2, 180);

-- ── posts (= completed quests). completion_ordinal stamped by hand (no RPC here) ─
-- Ordinals span the rare→common range on purpose: the masonry only makes rarity legible
-- when a "4TH EVER" sits next to a "1,204TH" (DESIGN.md → Quest list).
insert into public.posts (id, user_id, template_id, caption, visibility, completion_ordinal, city, created_at) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000001',
     'you have to time the tide and the man with the boat. no bridge, no signs, just vibes.',
     'public', 4,    'London', now() - interval '2 hours'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002',
     '70000000-0000-0000-0000-000000000002',
     'a japanese garden hidden behind a ruined jacobean mansion. the herons do not care about you.',
     'public', 212,  'London', now() - interval '5 hours'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003',
     '70000000-0000-0000-0000-000000000003',
     'a warehouse in walthamstow that is just every neon sign london ever threw away.',
     'public', 87,   'London', now() - interval '9 hours'),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000004',
     'the one legal graffiti tunnel in the city. it looks completely different every single week.',
     'public', 1204, 'London', now() - interval '1 day'),
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002',
     '70000000-0000-0000-0000-000000000005',
     'a victorian cemetery so overgrown it became a nature reserve. the chapel has no roof.',
     'public', 46,   'London', now() - interval '1 day 3 hours'),
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003',
     '70000000-0000-0000-0000-000000000006',
     'a red phone box someone turned into a library. take one, leave one. honour system.',
     'public', 631,  'London', now() - interval '2 days'),
  ('e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-000000000007',
     'edwardian oak galleries, a whole wall of glass at the end. nobody tells you to be quiet.',
     'public', 903,  'London', now() - interval '2 days 6 hours'),
  ('e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000002',
     '70000000-0000-0000-0000-000000000008',
     'clay pipes from the 1600s just sitting in the mud. you are allowed to look, not to dig.',
     'public', 18,   'London', now() - interval '3 days'),
  ('e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000003',
     '70000000-0000-0000-0000-000000000009',
     'six degrees, november, a lifeguard who has seen it all. best forty seconds of my week.',
     'public', 340,  'London', now() - interval '3 days 8 hours'),
  ('e0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000001',
     '70000000-0000-0000-0000-00000000000a',
     'the beigel shop that never closes. the queue at 2am is stranger than the daytime one.',
     'public', 1502, 'London', now() - interval '4 days');

-- ── one private post, so the anon feed check has something to correctly NOT show ──
insert into public.posts (id, user_id, template_id, caption, visibility, completion_ordinal, city, created_at) values
  ('e0000000-0000-0000-0000-0000000000ff', 'd0000000-0000-0000-0000-000000000002',
     '70000000-0000-0000-0000-000000000009',
     'kept this one private — testing that the feed respects visibility.',
     'private', 341, 'London', now() - interval '3 days 9 hours');

-- ── photos (1:N; here 1 each, dimensions = the real picsum request size) ─────────
insert into public.post_photos (post_id, storage_path, idx, width, height) values
  ('e0000000-0000-0000-0000-000000000001', 'https://picsum.photos/seed/getgo-eelpie/600/760',   0, 600, 760),
  ('e0000000-0000-0000-0000-000000000002', 'https://picsum.photos/seed/getgo-kyoto/600/900',    0, 600, 900),
  ('e0000000-0000-0000-0000-000000000003', 'https://picsum.photos/seed/getgo-neon/600/680',     0, 600, 680),
  ('e0000000-0000-0000-0000-000000000004', 'https://picsum.photos/seed/getgo-leake/600/840',    0, 600, 840),
  ('e0000000-0000-0000-0000-000000000005', 'https://picsum.photos/seed/getgo-nunhead/600/720',  0, 600, 720),
  ('e0000000-0000-0000-0000-000000000006', 'https://picsum.photos/seed/getgo-phonebox/600/800', 0, 600, 800),
  ('e0000000-0000-0000-0000-000000000007', 'https://picsum.photos/seed/getgo-daunt/600/880',    0, 600, 880),
  ('e0000000-0000-0000-0000-000000000008', 'https://picsum.photos/seed/getgo-mudlark/600/700',  0, 600, 700),
  ('e0000000-0000-0000-0000-000000000009', 'https://picsum.photos/seed/getgo-ponds/600/820',    0, 600, 820),
  ('e0000000-0000-0000-0000-00000000000a', 'https://picsum.photos/seed/getgo-beigel/600/940',   0, 600, 940);

-- ── ratings — reception is reportage ("N said awesome"), never a score the client sets.
-- Only the two demo authors who did NOT post each quest rate it (no self-rating; enforced by
-- RLS too). Small numbers by design: 3 seed users, so the sentence reads honestly, not big.
insert into public.ratings (post_id, rater_id, value) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'awesome'),
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'awesome'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'awesome'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'could_be_cooler'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'awesome'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'awesome'),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'awesome'),
  ('e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000001', 'awesome'),
  ('e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000002', 'awesome');
