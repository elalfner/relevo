begin;
select plan(3);

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

insert into public.credentials (user_id, password_hash) values ('00000000-0000-0000-0000-000000000001', 'old');
select public.admin_reset_password('00000000-0000-0000-0000-000000000001', 'new');

select is(
  (select count(*)::int from public.audit_log
    where action = 'password_reset' and target_id = '00000000-0000-0000-0000-000000000001'),
  1,
  'a password reset leaves a row in the audit log'
);

select * from finish();
rollback;
