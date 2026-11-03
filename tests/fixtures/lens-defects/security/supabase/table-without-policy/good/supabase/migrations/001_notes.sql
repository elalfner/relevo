create table public.notes (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id),
  body text not null
);

alter table public.notes enable row level security;

create policy "owners read their notes" on public.notes
  for select to authenticated using ((select auth.uid()) = owner);
