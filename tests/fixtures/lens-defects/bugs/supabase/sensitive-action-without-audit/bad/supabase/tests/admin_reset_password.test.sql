begin;
select plan(2);

select throws_ok(
  $$ select public.admin_reset_password('00000000-0000-0000-0000-000000000001', 'x') $$,
  '42501',
  'forbidden',
  'a person who is not an administrator cannot reset a password'
);

select set_config('request.jwt.claims', '{"role":"administrator","sub":"00000000-0000-0000-0000-0000000000aa"}', true);

select throws_ok(
  $$ select public.admin_reset_password('00000000-0000-0000-0000-0000000000ff', 'x') $$,
  'P0002',
  'user not found',
  'an unknown user is reported'
);

select * from finish();
rollback;
