-- "Track your payment": doctors tick when they have received payment for a slot.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.slots add column if not exists paid_confirmed_at timestamptz;
-- Who confirmed: 'doctor' or 'admin'. A doctor's tick is final; only admin can undo.
alter table public.slots add column if not exists paid_confirmed_by text;

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

  -- Doctor ticks / unticks "I've been paid" on their own approved slot.
  -- Only paid_confirmed_at / paid_confirmed_by may change, and only from unpaid to paid.
  if owns_slot
     and old.status = 'Approved'
     and new.status = old.status
     and new.nama_locum is not distinct from old.nama_locum
     and new.no_telefon_locum is not distinct from old.no_telefon_locum
     and new.booked_at is not distinct from old.booked_at
     and new.sales is not distinct from old.sales
     and new.bilangan_pesakit is not distinct from old.bilangan_pesakit
     and new.performance_recorded is not distinct from old.performance_recorded
     -- a doctor can only mark paid once; it can never be undone by the doctor
     and old.paid_confirmed_at is null
     and new.paid_confirmed_at is not null
     and new.paid_confirmed_by = 'doctor'
  then
    return new;
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

-- The update policy's WITH CHECK only allowed new rows that were 'Pending' or
-- 'Available', so ticking "paid" on an Approved slot hit an RLS violation.
-- Also allow the row to stay 'Approved' while it still belongs to the caller.
-- The guard trigger above still restricts doctors to changing only
-- paid_confirmed_at on such a row.
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
      status = 'Approved'
      and no_telefon_locum = (auth.jwt() -> 'user_metadata' ->> 'phone')
    )
    or (
      status = 'Available'
      and coalesce(no_telefon_locum, '') = ''
      and coalesce(nama_locum, '') = ''
    )
  );
