-- Run once in Supabase SQL Editor after enabling Supabase Auth.
-- These policies keep the existing app flow working for authenticated users:
-- doctors can read slots and claim an Available slot; admins can manage slots.

-- Prefer Auth app_metadata for role checks. The users-table fallback keeps
-- existing accounts compatible while preventing the UI from being the only
-- security boundary.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) = 'admin'
    or exists (
      select 1 from public.users u
      where trim(u.phone::text) = trim(auth.jwt() -> 'user_metadata' ->> 'phone')
        and lower(trim(u.role::text)) = 'admin'
    )
    or exists (
      select 1 from public.users u
      where lower(trim(coalesce(u.email::text, ''))) =
            lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and lower(trim(u.role::text)) = 'admin'
    );
$$;

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
  with check (public.is_app_admin());

drop policy if exists "authenticated can claim or manage slots" on public.slots;
create policy "authenticated can claim or manage slots"
  on public.slots for update
  to authenticated
  using (
    public.is_app_admin()
    or status = 'Available'
    or no_telefon_locum = (auth.jwt() -> 'user_metadata' ->> 'phone')
  )
  with check (
    public.is_app_admin()
    or (
      status = 'Pending'
      and no_telefon_locum = (auth.jwt() -> 'user_metadata' ->> 'phone')
    )
    or (
      status = 'Available'
      and coalesce(no_telefon_locum, '') = ''
      and coalesce(nama_locum, '') = ''
    )
  );

drop policy if exists "admins can delete slots" on public.slots;
create policy "admins can delete slots"
  on public.slots for delete
  to authenticated
  using (public.is_app_admin());

-- RLS checks rows, but not which columns a doctor changes. This trigger
-- preserves booking and self-cancellation while making date, time, branch,
-- pay and slot identity immutable for doctors.
create or replace function public.guard_doctor_slot_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_phone text := trim(auth.jwt() -> 'user_metadata' ->> 'phone');
  owns_slot boolean := trim(coalesce(old.no_telefon_locum, '')) = actor_phone;
begin
  if public.is_app_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.tarikh is distinct from old.tarikh
     or new.masa is distinct from old.masa
     or new.cawangan is distinct from old.cawangan
     or new.bayaran is distinct from old.bayaran
  then
    raise exception 'Doctors may not edit slot details';
  end if;

  if old.status = 'Available'
     and new.status = 'Pending'
     and trim(coalesce(new.no_telefon_locum, '')) = actor_phone
  then
    return new;
  end if;

  if owns_slot
     and old.status in ('Pending', 'Approved')
     and new.status = 'Available'
     and trim(coalesce(new.no_telefon_locum, '')) = ''
     and trim(coalesce(new.nama_locum, '')) = ''
  then
    return new;
  end if;

  raise exception 'Doctors may only claim available slots or release their own slot';
end;
$$;

drop trigger if exists guard_doctor_slot_update on public.slots;
create trigger guard_doctor_slot_update
  before update on public.slots
  for each row execute function public.guard_doctor_slot_update();

grant insert on table public.activity_logs to authenticated;
alter table public.activity_logs enable row level security;

drop policy if exists "authenticated can write activity logs" on public.activity_logs;
create policy "authenticated can write activity logs"
  on public.activity_logs for insert
  to authenticated
  with check (true);

-- Authenticated app features also read/write these non-sensitive tables.
-- Passwords are not stored in any of them.
grant select, insert, update, delete on table public.notifications to authenticated;
alter table public.notifications enable row level security;
drop policy if exists "authenticated can use notifications" on public.notifications;
drop policy if exists "users can read own notifications" on public.notifications;
drop policy if exists "admins can create notifications" on public.notifications;
drop policy if exists "users can update own notifications" on public.notifications;
drop policy if exists "users can delete own notifications" on public.notifications;
create policy "users can read own notifications"
  on public.notifications for select to authenticated
  using (public.is_app_admin() or phone = (auth.jwt() -> 'user_metadata' ->> 'phone'));
create policy "admins can create notifications"
  on public.notifications for insert to authenticated
  with check (public.is_app_admin());
create policy "users can update own notifications"
  on public.notifications for update to authenticated
  using (public.is_app_admin() or phone = (auth.jwt() -> 'user_metadata' ->> 'phone'))
  with check (public.is_app_admin() or phone = (auth.jwt() -> 'user_metadata' ->> 'phone'));
create policy "users can delete own notifications"
  on public.notifications for delete to authenticated
  using (public.is_app_admin() or phone = (auth.jwt() -> 'user_metadata' ->> 'phone'));

grant select, insert, update, delete on table public.admin_alerts to authenticated;
alter table public.admin_alerts enable row level security;
drop policy if exists "authenticated can use admin alerts" on public.admin_alerts;
drop policy if exists "admins can read admin alerts" on public.admin_alerts;
drop policy if exists "authenticated can create admin alerts" on public.admin_alerts;
drop policy if exists "admins can delete admin alerts" on public.admin_alerts;
create policy "admins can read admin alerts"
  on public.admin_alerts for select to authenticated
  using (public.is_app_admin());
create policy "authenticated can create admin alerts"
  on public.admin_alerts for insert to authenticated
  with check (true);
create policy "admins can delete admin alerts"
  on public.admin_alerts for delete to authenticated
  using (public.is_app_admin());

grant select, insert, update, delete on table public.badge_awards to authenticated;
alter table public.badge_awards enable row level security;
drop policy if exists "authenticated can use badge awards" on public.badge_awards;
drop policy if exists "authenticated can read badge awards" on public.badge_awards;
drop policy if exists "admins can manage badge awards" on public.badge_awards;
create policy "authenticated can read badge awards"
  on public.badge_awards for select to authenticated
  using (true);
create policy "admins can manage badge awards"
  on public.badge_awards for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

grant select, insert, update, delete on table public.announcements to authenticated;
alter table public.announcements enable row level security;
drop policy if exists "authenticated can use announcements" on public.announcements;
drop policy if exists "authenticated can read announcements" on public.announcements;
drop policy if exists "admins can manage announcements" on public.announcements;
create policy "authenticated can read announcements"
  on public.announcements for select to authenticated
  using (true);
create policy "admins can manage announcements"
  on public.announcements for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- CLINIC BRANCHES ------------------------------------------------------------
create table if not exists public.clinic_branches (
  id text primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on table public.clinic_branches to authenticated;
alter table public.clinic_branches enable row level security;
drop policy if exists "authenticated can read clinic branches" on public.clinic_branches;
drop policy if exists "admins can manage clinic branches" on public.clinic_branches;
create policy "authenticated can read clinic branches"
  on public.clinic_branches for select to authenticated
  using (is_active = true);
create policy "admins can manage clinic branches"
  on public.clinic_branches for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
