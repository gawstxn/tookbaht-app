-- Deleting a Tookbaht account takes effect after 30 days. Asking for it needs
-- a fresh sign-in (within 10 minutes), closes the account and stops push; any
-- sign-in before the 30 days are up can restore it. A daily job then removes
-- the user for good (every table cascades from auth.users).

alter table public.profiles add column deletion_requested_at timestamptz;

create function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select u.last_sign_in_at into v_last from auth.users u where u.id = auth.uid();
  if v_last is null or v_last < now() - interval '10 minutes' then
    raise exception 'reauthentication required' using errcode = '42501';
  end if;
  update public.profiles set deletion_requested_at = now() where id = auth.uid();
  delete from public.push_subscriptions where user_id = auth.uid();
  return now() + interval '30 days';
end;
$$;

create function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles set deletion_requested_at = null where id = auth.uid();
end;
$$;

-- Accounts whose 30 days are up. Returns how many were removed.
create function public.purge_deleted_accounts()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.deletion_requested_at < now() - interval '30 days'
    returning u.id
  )
  select count(*)::integer from gone
$$;

-- Immediate deletion is no longer offered to users.
revoke execute on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to service_role;

revoke execute on function public.request_account_deletion(), public.cancel_account_deletion(), public.purge_deleted_accounts() from public, anon, authenticated;
grant execute on function public.request_account_deletion(), public.cancel_account_deletion() to authenticated;
grant execute on function public.purge_deleted_accounts() to service_role;

/* ---------- schedule ---------- */

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'purge-deleted-accounts',
  '17 3 * * *',
  $$select public.purge_deleted_accounts()$$
);
