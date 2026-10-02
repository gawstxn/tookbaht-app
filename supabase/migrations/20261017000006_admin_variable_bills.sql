-- An admin role (who signed up, when they last used the app, problem reports,
-- suspending an account that abuses the app) and bills whose amount changes
-- every time (water, electricity).

/* ---------- profiles: role, last use, suspension ---------- */

-- Users can still only change their name and settings (column grants in
-- 20261004000000), so none of these are theirs to write. An admin is made by
-- hand: update public.profiles set role = 'admin' where email = '…'.
alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin')),
  add column last_active_at timestamptz,
  add column suspended_at timestamptz,
  -- Why, for the admin's own reference; the user never sees it.
  add column suspended_note text not null default '' check (char_length(suspended_note) <= 200);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.suspended_at is null
  )
$$;
revoke execute on function public.is_admin() from public, anon, authenticated;

-- The app calls this when it opens or comes back to the foreground. Written at
-- most once every five minutes per user, so it costs next to nothing.
create function public.touch_active()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set last_active_at = now()
   where id = (select auth.uid())
     and (last_active_at is null or last_active_at < now() - interval '5 minutes')
$$;
revoke execute on function public.touch_active() from public, anon, authenticated;
grant execute on function public.touch_active() to authenticated;

/* ---------- suspension: refused before any request runs ---------- */

-- PostgREST calls this ahead of every API request (tables and functions
-- alike), so a suspended account can neither read nor write, and tables added
-- later are covered without a policy of their own. The app shows its
-- "account suspended" screen when it sees the PT403 code (HTTP 403).
create function public.check_request()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.suspended_at is not null) then
    raise sqlstate 'PT403' using message = 'account suspended', hint = 'suspended';
  end if;
end;
$$;
revoke execute on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated, service_role;

do $$
begin
  -- The role PostgREST connects as; absent in the test database.
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    alter role authenticator set pgrst.db_pre_request = 'public.check_request';
    notify pgrst, 'reload config';
  end if;
end;
$$;

/* ---------- admin: users ---------- */

-- Who uses the app: name, email, dates and how many entries they keep (a
-- count, to spot an account writing in a loop). Never what the entries say.
create function public.admin_users(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, email text, avatar text, role text, created_at timestamptz, last_active_at timestamptz,
               entries bigint, suspended_at timestamptz, suspended_note text, deletion_requested_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select p.id, p.name, p.email, p.settings ->> 'avatar', p.role, p.created_at, p.last_active_at,
      (select count(*) from public.transactions t where t.user_id = p.id),
      p.suspended_at, p.suspended_note, p.deletion_requested_at
    from public.profiles p
    where coalesce(p_search, '') = ''
      or position(lower(p_search) in lower(p.name)) > 0
      or position(lower(p_search) in lower(p.email)) > 0
    order by p.last_active_at desc nulls last, p.created_at desc, p.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Totals for the top of the admin screen, and how full the database is (the
-- free tier allows 500 MB).
create function public.admin_overview()
returns table (users bigint, active_day bigint, active_week bigint, suspended bigint, feedback_open bigint, db_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select
      count(*),
      count(*) filter (where p.last_active_at > now() - interval '1 day'),
      count(*) filter (where p.last_active_at > now() - interval '7 days'),
      count(*) filter (where p.suspended_at is not null),
      (select count(*) from public.feedback f where f.resolved_at is null),
      pg_database_size(current_database())
    from public.profiles p;
end;
$$;

-- Suspend an account, or lift the suspension. Admins can't be suspended (so
-- an admin can't lock themselves, or each other, out).
create function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_suspended and exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin') then
    raise exception 'an admin cannot be suspended' using errcode = 'P0001', hint = 'is_admin';
  end if;
  update public.profiles p
     set suspended_at = case when p_suspended then coalesce(p.suspended_at, now()) end,
         suspended_note = case when p_suspended then left(coalesce(p_note, ''), 200) else '' end
   where p.id = p_user;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
end;
$$;

-- One account in more detail, for spotting abuse (an account writing in a
-- loop, feedback spam, one user filling the database). Counts and sizes
-- only: never amounts, names of accounts or friends, notes, or settings.
create function public.admin_user_detail(p_user uuid)
returns table (accounts bigint, subscriptions bigint, ious bigint, savings_goals bigint, wishes bigint, entries bigint,
               entries_day bigint, entries_week bigint, feedback bigint, feedback_day bigint, push_devices bigint,
               data_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select
      (select count(*) from public.accounts a where a.user_id = p.id),
      (select count(*) from public.subscriptions s where s.user_id = p.id),
      (select count(*) from public.ious i where i.user_id = p.id),
      (select count(*) from public.savings_goals g where g.user_id = p.id),
      (select count(*) from public.wishes w where w.user_id = p.id),
      (select count(*) from public.transactions t where t.user_id = p.id),
      (select count(*) from public.transactions t where t.user_id = p.id and t.created_at > now() - interval '1 day'),
      (select count(*) from public.transactions t where t.user_id = p.id and t.created_at > now() - interval '7 days'),
      (select count(*) from public.feedback f where f.user_id = p.id),
      (select count(*) from public.feedback f where f.user_id = p.id and f.created_at > now() - interval '1 day'),
      (select count(*) from public.push_subscriptions d where d.user_id = p.id),
      -- Row data only (indexes come on top: a transaction is about 330 bytes with them).
      (
        coalesce((select sum(pg_column_size(t.*)) from public.transactions t where t.user_id = p.id), 0)
        + coalesce((select sum(pg_column_size(a.*)) from public.accounts a where a.user_id = p.id), 0)
        + coalesce((select sum(pg_column_size(s.*)) from public.subscriptions s where s.user_id = p.id), 0)
        + coalesce((select sum(pg_column_size(i.*)) from public.ious i where i.user_id = p.id), 0)
        + coalesce((select sum(pg_column_size(g.*)) from public.savings_goals g where g.user_id = p.id), 0)
        + coalesce((select sum(pg_column_size(w.*)) from public.wishes w where w.user_id = p.id), 0)
        + coalesce((select sum(pg_column_size(f.*)) from public.feedback f where f.user_id = p.id), 0)
        + pg_column_size(p.*)
      )::bigint
    from public.profiles p
    where p.id = p_user;
end;
$$;
revoke execute on function public.admin_user_detail(uuid) from public, anon, authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;

/* ---------- admin: problem reports ---------- */

-- Set once the report has been dealt with.
alter table public.feedback add column resolved_at timestamptz;

create function public.admin_feedback(p_open_only boolean default false, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, user_id uuid, name text, email text, message text, app_version text, page text, user_agent text,
               created_at timestamptz, resolved_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select f.id, f.user_id, p.name, p.email, f.message, f.app_version, f.page, f.user_agent, f.created_at, f.resolved_at
    from public.feedback f
    join public.profiles p on p.id = f.user_id
    where not coalesce(p_open_only, false) or f.resolved_at is null
    order by f.created_at desc, f.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create function public.admin_resolve_feedback(p_id uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.feedback f set resolved_at = case when p_resolved then coalesce(f.resolved_at, now()) end where f.id = p_id;
end;
$$;

revoke execute on function
  public.admin_users(text, integer, integer), public.admin_overview(), public.admin_set_suspended(uuid, boolean, text),
  public.admin_feedback(boolean, integer, integer), public.admin_resolve_feedback(uuid, boolean)
from public, anon, authenticated;
-- Signed-in users may call them; each one refuses anyone who isn't an admin.
grant execute on function
  public.admin_users(text, integer, integer), public.admin_overview(), public.admin_set_suspended(uuid, boolean, text),
  public.admin_feedback(boolean, integer, integer), public.admin_resolve_feedback(uuid, boolean)
to authenticated;

/* ---------- bills whose amount changes every time ---------- */

-- Water, electricity, a phone bill: due on a schedule, but the amount is only
-- known when it's paid. Never logged automatically; the user enters what they
-- paid, and `amount` holds the latest bill as the estimate for the next one.
alter table public.subscriptions
  add column variable boolean not null default false,
  add constraint subscriptions_variable
    check (not variable or (kind = 'recurring' and entry_type = 'out' and installments is null and not auto_log));

-- The day-before reminder says when a bill's amount isn't fixed, and is left
-- out once that bill was paid early or skipped. Mirrors lib/bills.ts: a
-- payment counts for a due date from half a cycle before it.
drop function public.pending_reminders();
create function public.pending_reminders()
returns table (subscription_id uuid, user_id uuid, name text, amount numeric, currency text, due_date date, account_name text,
               kind text, installment_no integer, installments integer, trial boolean, variable boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.name, s.amount, s.currency, d.due, a.name, s.kind, d.i + 1, s.installments,
    (d.i = 0 and s.trial_from is not null), s.variable
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  join public.accounts a on a.id = s.account_id
  cross join lateral (
    select i, public.billing_date(s.start_date, s.cycle, i) as due
    from generate_series(0, (public.user_today(p.timezone) + 1 - s.start_date) / 7 + 1) as i
  ) d
  where s.remind
    and not s.paused
    and s.entry_type <> 'in'
    and (s.installments is null or d.i < s.installments)
    and d.due = public.user_today(p.timezone) + 1
    and not exists (
      select 1 from public.reminders_sent r where r.subscription_id = s.id and r.due_date = d.due
    )
    and not (s.variable and (
      exists (
        select 1 from public.transactions t
        where t.subscription_id = s.id
          and t.date > d.due - case s.cycle when 'week' then 3 when 'month' then 15 else 182 end
      )
      or coalesce(p.settings -> 'billSkipped', '[]'::jsonb) ? (s.id::text || ':' || d.due::text)
    ))
$$;
revoke execute on function public.pending_reminders() from public, anon, authenticated;
grant execute on function public.pending_reminders() to service_role;
