create table public.credentials (
  user_id uuid primary key,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key,
  role text not null
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select coalesce(auth.jwt() ->> 'role', '') = 'administrator' $$;

create function public.change_role(target uuid, new_role text) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.profiles set role = new_role where id = target;

  insert into public.audit_log (actor_id, action, target_id)
  values (auth.uid(), 'role_changed', target);
end;
$$;

create function public.admin_reset_password(target uuid, new_hash text) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.credentials set password_hash = new_hash, updated_at = now() where user_id = target;

  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  insert into public.audit_log (actor_id, action, target_id)
  values (auth.uid(), 'password_reset', target);
end;
$$;
