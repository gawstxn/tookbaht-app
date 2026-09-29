-- A week before a yearly service renews (a domain, iCloud), ask whether it's
-- still used, in time to cancel with the provider. Mirrors lib/renewals.ts;
-- the day before is left to pending_reminders(), so this one covers 2–7 days
-- ahead and a yearly service added late in that window is still asked once.

-- Reviews already delivered, so a retried cron run doesn't push twice.
create table public.renewal_reviews_sent (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  due_date date not null,
  sent_at timestamptz not null default now(),
  primary key (subscription_id, due_date)
);
alter table public.renewal_reviews_sent enable row level security;
-- No policies: only the service role (which bypasses RLS) uses it.
revoke all on public.renewal_reviews_sent from anon, authenticated;
grant select, insert, delete on public.renewal_reviews_sent to service_role;

create function public.pending_renewal_reviews()
returns table (subscription_id uuid, user_id uuid, name text, amount numeric, currency text, due_date date, days integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.name, s.amount, s.currency, d.due, d.due - public.user_today(p.timezone)
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  cross join lateral (
    select public.billing_date(s.start_date, s.cycle, i) as due
    from generate_series(0, greatest(0, (public.user_today(p.timezone) - s.start_date) / 365 + 1)) as i
  ) d
  where s.remind
    and not s.paused
    and s.kind <> 'recurring'
    and s.cycle = 'year'
    and d.due between public.user_today(p.timezone) + 2 and public.user_today(p.timezone) + 7
    and not exists (
      select 1 from public.renewal_reviews_sent r where r.subscription_id = s.id and r.due_date = d.due
    )
$$;
revoke execute on function public.pending_renewal_reviews() from public, anon, authenticated;
grant execute on function public.pending_renewal_reviews() to service_role;

-- Clear delivered reviews with the other push logs.
create or replace function public.purge_old_logs()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.reminders_sent where due_date < current_date - 7;
  delete from public.due_reminders_sent where due_date < current_date - 7;
  delete from public.renewal_reviews_sent where due_date < current_date - 7;
  delete from public.log_reminders_sent where date < current_date - 7;
  delete from public.budget_alerts_sent where month < to_char(current_date - 70, 'YYYY-MM');
  delete from public.month_summaries_sent where month < to_char(current_date - 100, 'YYYY-MM');
$$;
