-- Server-side subscription auto-log (pg_cron) and Web Push reminders.

/* ---------- per-user timezone ---------- */

-- "Today" for billing is the user's local date.
alter table public.profiles add column timezone text not null default 'Asia/Bangkok';

create function public.user_today(p_timezone text)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone p_timezone)::date
$$;

/* ---------- billing dates ---------- */

-- The i-th billing date. Month/year cycles keep the start day, clamped to the
-- end of shorter months (same rule as stepCycle in lib/format.ts).
create function public.billing_date(p_start date, p_cycle public.billing_cycle, p_i integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_cycle
    when 'week' then p_start + 7 * p_i
    when 'month' then (p_start + make_interval(months => p_i))::date
    else (p_start + make_interval(years => p_i))::date
  end
$$;

/* ---------- auto-log ---------- */

-- Log every due charge up to each user's local today (all users when p_user
-- is null). Idempotent through the unique (subscription_id, date) constraint.
-- Returns the rows it inserted.
create function public.log_due_subscriptions(p_user uuid default null)
returns setof public.transactions
language sql
security definer
set search_path = ''
as $$
  insert into public.transactions (user_id, type, amount, date, title, category, account_id, subscription_id)
  select s.user_id, 'out', s.amount, d.due, s.name, 'sub', s.account_id, s.id
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  cross join lateral (
    -- Weeks elapsed bounds the number of billing dates for every cycle.
    select public.billing_date(s.start_date, s.cycle, i) as due
    from generate_series(0, (public.user_today(p.timezone) - s.start_date) / 7 + 1) as i
  ) d
  where s.auto_log
    and not s.paused
    and (p_user is null or s.user_id = p_user)
    and d.due <= public.user_today(p.timezone)
  on conflict (subscription_id, date) do nothing
  returning *
$$;

-- What the app calls on load: the same, for the signed-in user only.
create function public.run_my_auto_log()
returns setof public.transactions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return query select * from public.log_due_subscriptions(auth.uid());
end;
$$;

/* ---------- push subscriptions ---------- */

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Save this device's push subscription for the signed-in user. An endpoint
-- belongs to one browser, so a previous owner (e.g. after switching Google
-- accounts on the same phone) is replaced.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent);
end;
$$;

/* ---------- reminders ---------- */

-- Reminders already delivered, so a retried cron run doesn't notify twice.
create table public.reminders_sent (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  due_date date not null,
  sent_at timestamptz not null default now(),
  primary key (subscription_id, due_date)
);

-- Subscriptions that bill tomorrow (user's local date), have reminders on,
-- and haven't been reminded about yet.
create function public.pending_reminders()
returns table (subscription_id uuid, user_id uuid, name text, amount numeric, due_date date, account_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.name, s.amount, d.due, a.name
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  join public.accounts a on a.id = s.account_id
  cross join lateral (
    select public.billing_date(s.start_date, s.cycle, i) as due
    from generate_series(0, (public.user_today(p.timezone) + 1 - s.start_date) / 7 + 1) as i
  ) d
  where s.remind
    and not s.paused
    and d.due = public.user_today(p.timezone) + 1
    and not exists (
      select 1 from public.reminders_sent r where r.subscription_id = s.id and r.due_date = d.due
    )
$$;

/* ---------- privileges ---------- */

grant update (timezone) on public.profiles to authenticated;

revoke all on public.push_subscriptions, public.reminders_sent from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

revoke execute on function public.log_due_subscriptions(uuid) from public, anon, authenticated;
revoke execute on function public.pending_reminders() from public, anon, authenticated;
revoke execute on function public.run_my_auto_log() from public, anon;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.run_my_auto_log() to authenticated;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.log_due_subscriptions(uuid), public.pending_reminders() to service_role;
grant select, insert, delete on public.push_subscriptions, public.reminders_sent to service_role;

alter table public.push_subscriptions enable row level security;
alter table public.reminders_sent enable row level security;

create policy "push_subscriptions: own rows" on public.push_subscriptions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- reminders_sent: no policies; only the service role (which bypasses RLS) uses it.

/* ---------- schedule ---------- */

create extension if not exists pg_cron with schema pg_catalog;

-- Hourly, so every timezone gets its charges logged shortly after local midnight.
select cron.schedule(
  'log-due-subscriptions',
  '5 * * * *',
  $$select count(*) from public.log_due_subscriptions()$$
);
