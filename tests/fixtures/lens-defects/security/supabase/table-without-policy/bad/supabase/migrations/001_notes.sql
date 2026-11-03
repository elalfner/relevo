create table public.notes (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id),
  body text not null
);
