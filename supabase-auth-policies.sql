-- Run once in Supabase SQL Editor after enabling Supabase Auth.
-- These policies keep the existing app flow working for authenticated users:
-- doctors can read slots and claim an Available slot; admins can manage slots.

grant select on table public.slots to authenticated;
grant insert, update, delete on table public.slots to authenticated;

alter table public.slots enable row level security;

drop policy if exists "authenticated can read slots" on public.slots;
create policy "authenticated can read slots"
  on public.slots for select
  to authenticated
  using (true);

drop policy if exists "admins can create slots" on public.slots;
create policy "admins can create slots"
  on public.slots for insert
  to authenticated
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'Admin');

drop policy if exists "authenticated can claim or manage slots" on public.slots;
create policy "authenticated can claim or manage slots"
  on public.slots for update
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'Admin'
    or status = 'Available'
  )
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'Admin'
    or (
      status = 'Pending'
      and no_telefon_locum = (auth.jwt() -> 'user_metadata' ->> 'phone')
    )
  );

drop policy if exists "admins can delete slots" on public.slots;
create policy "admins can delete slots"
  on public.slots for delete
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'Admin');

grant insert on table public.activity_logs to authenticated;
alter table public.activity_logs enable row level security;

drop policy if exists "authenticated can write activity logs" on public.activity_logs;
create policy "authenticated can write activity logs"
  on public.activity_logs for insert
  to authenticated
  with check (true);
