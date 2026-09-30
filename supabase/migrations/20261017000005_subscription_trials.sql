-- Free trials (Google AI Pro free for a year, 1 month of YouTube Premium).
-- A trial is the stretch before the first charge: start_date stays the first
-- billing date, so auto-log, reminders and forecasts need no change, and
-- trial_from records when the free period began. Mirrors lib/trial.ts.

alter table public.subscriptions
  add column trial_from date,
  add constraint subscriptions_trial check (trial_from is null or (kind = 'subscription' and trial_from < start_date));

-- A few days before a trial ends, ask whether it's still wanted (in time to
-- cancel). Trials of any cycle join the yearly renewal reviews: same table,
-- same push, flagged `trial`. The day before is left to pending_reminders().
drop function public.pending_renewal_reviews();
create function public.pending_renewal_reviews()
returns table (subscription_id uuid, user_id uuid, name text, amount numeric, currency text, due_date date, days integer, trial boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.name, s.amount, s.currency, d.due, d.due - public.user_today(p.timezone), d.trial
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  cross join lateral (
    select public.billing_date(s.start_date, s.cycle, i) as due, (i = 0 and s.trial_from is not null) as trial
    from generate_series(0, greatest(0, (public.user_today(p.timezone) - s.start_date) / 365 + 1)) as i
  ) d
  where s.remind
    and not s.paused
    and s.kind <> 'recurring'
    and (
      -- A trial ending: 3 days ahead, or 2 when it was added late.
      (d.trial and d.due between public.user_today(p.timezone) + 2 and public.user_today(p.timezone) + 3)
      -- A yearly renewal: within the week.
      or (not d.trial and s.cycle = 'year' and d.due between public.user_today(p.timezone) + 2 and public.user_today(p.timezone) + 7)
    )
    and not exists (
      select 1 from public.renewal_reviews_sent r where r.subscription_id = s.id and r.due_date = d.due
    )
$$;
revoke execute on function public.pending_renewal_reviews() from public, anon, authenticated;
grant execute on function public.pending_renewal_reviews() to service_role;

-- The day-before reminder says when the charge is the first after a trial.
drop function public.pending_reminders();
create function public.pending_reminders()
returns table (subscription_id uuid, user_id uuid, name text, amount numeric, currency text, due_date date, account_name text,
               kind text, installment_no integer, installments integer, trial boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.name, s.amount, s.currency, d.due, a.name, s.kind, d.i + 1, s.installments, (d.i = 0 and s.trial_from is not null)
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
$$;
revoke execute on function public.pending_reminders() from public, anon, authenticated;
grant execute on function public.pending_reminders() to service_role;
