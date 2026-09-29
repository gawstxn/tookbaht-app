-- The user's month can start on their payday (settings.cycleStartDay, 1–31)
-- instead of the 1st. Budget alerts, rollover and the monthly summary count
-- by it, like the app does. Mirrors lib/period.ts: a month runs from the start
-- day to the day before the next one, starts on the last day of months
-- too short for it, and is named after the month holding most of its days
-- (start days after the 16th take the next month's name).

/* ---------- periods ---------- */

-- The start day saved in settings; 1 when unset or not a whole day 1–31.
create function public.cycle_start_day(p_settings jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_settings -> 'cycleStartDay') = 'number'
      and (p_settings ->> 'cycleStartDay') ~ '^([1-9]|[12][0-9]|3[01])$'
    then (p_settings ->> 'cycleStartDay')::integer
    else 1
  end
$$;

-- The start day within the calendar month of p_month.
create function public.cycle_start_in(p_month date, p_day integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('month', p_month)::date
    + least(p_day, extract(day from date_trunc('month', p_month) + interval '1 month - 1 day')::integer) - 1
$$;

-- The user's month holding p_date, moved p_offset months (-1: the one before):
-- its first day, the next one's first day, and its "YYYY-MM" name.
create function public.user_period(p_date date, p_day integer, p_offset integer default 0)
returns table (start_date date, next_start date, month text)
language sql
immutable
set search_path = ''
as $$
  with base as (
    select (case
      when p_date >= public.cycle_start_in(p_date, p_day) then date_trunc('month', p_date)
      else date_trunc('month', p_date) - interval '1 month'
    end + make_interval(months => p_offset))::date as m
  )
  select
    public.cycle_start_in(m, p_day),
    public.cycle_start_in((m + interval '1 month')::date, p_day),
    to_char(m + case when p_day > 16 then interval '1 month' else interval '0' end, 'YYYY-MM')
  from base
$$;

revoke execute on function public.cycle_start_day(jsonb) from public, anon, authenticated;
revoke execute on function public.cycle_start_in(date, integer) from public, anon, authenticated;
revoke execute on function public.user_period(date, integer, integer) from public, anon, authenticated;

/* ---------- rollover over any period ---------- */

-- What a category carries out of the month [p_from, p_to): its budget minus what it spent, never negative.
create function public.category_carry(p_user uuid, p_key text, p_budget numeric, p_from date, p_to date)
returns numeric
language sql
stable
set search_path = ''
as $$
  select greatest(0, p_budget - coalesce((
    select sum(t.amount) from public.transactions t
    where t.user_id = p_user and t.type = 'out' and t.category = p_key
      and t.date >= p_from and t.date < p_to
  ), 0))
$$;
revoke execute on function public.category_carry(uuid, text, numeric, date, date) from public, anon, authenticated;

/* ---------- budget alerts: the user's current month ---------- */

create or replace function public.pending_budget_alerts()
returns table (user_id uuid, month text, budget_key text, level smallint, spent numeric, budget numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select p.id as user_id, c.start_date as m0, c.next_start as m1, c.month, prev.start_date as prev0
    from public.profiles p
    cross join lateral public.user_period(public.user_today(p.timezone), public.cycle_start_day(p.settings)) c
    cross join lateral public.user_period(public.user_today(p.timezone), public.cycle_start_day(p.settings), -1) prev
  ),
  lines as (
    select g.user_id, 'total'::text as budget_key, g.expense_budget as budget, g.alert_at_80
    from public.goals g where g.expense_budget > 0
    union all
    select g.user_id, c.key,
      c.value::numeric + case when c.key = any (g.rollover_keys) then public.category_carry(g.user_id, c.key, c.value::numeric, b.prev0, b.m0) else 0 end,
      g.alert_at_80
    from public.goals g
    join bounds b on b.user_id = g.user_id
    cross join lateral jsonb_each_text(g.category_budgets) c
    where c.value ~ '^[0-9.]+$' and c.value::numeric > 0
  ),
  spend as (
    select l.user_id, l.budget_key, l.budget, l.alert_at_80, b.month,
      greatest(0, coalesce((select sum(case when t.type = 'out' then t.amount else -t.amount end) from public.transactions t
                where t.user_id = l.user_id
                  and t.date >= b.m0 and t.date < b.m1
                  and ((t.type = 'out' and (l.budget_key = 'total' or t.category = l.budget_key))
                       -- Repayments count against the overall budget only (their bill's category isn't known).
                       or (l.budget_key = 'total' and t.type = 'in' and t.category = 'repay'))), 0)) as spent
    from lines l join bounds b on b.user_id = l.user_id
  ),
  levels as (
    select s.*, case when s.spent > s.budget then 100 when s.alert_at_80 and s.spent >= 0.8 * s.budget then 80 end::smallint as level
    from spend s
  )
  select l.user_id, l.month, l.budget_key, l.level, l.spent, l.budget
  from levels l
  where l.level is not null
    and not exists (
      select 1 from public.budget_alerts_sent x
      where x.user_id = l.user_id and x.month = l.month and x.budget_key = l.budget_key and x.level >= l.level
    )
$$;

/* ---------- monthly summary: the first 3 days of the user's month ---------- */

create or replace function public.pending_month_summaries()
returns table (user_id uuid, month text, income numeric, expense numeric, over_budget text[])
language sql
stable
security definer
set search_path = ''
as $$
  with users as (
    select p.id as user_id, last.start_date as m0, last.next_start as m1, last.month, before.start_date as prev0
    from public.profiles p
    cross join lateral public.user_period(public.user_today(p.timezone), public.cycle_start_day(p.settings)) cur
    cross join lateral public.user_period(public.user_today(p.timezone), public.cycle_start_day(p.settings), -1) last
    cross join lateral public.user_period(public.user_today(p.timezone), public.cycle_start_day(p.settings), -2) before
    where public.user_today(p.timezone) - cur.start_date <= 2
      and p.deletion_requested_at is null
      and coalesce(p.settings ->> 'monthlySummary', 'true') <> 'false'
  ),
  totals as (
    select u.user_id, u.m0, u.m1, u.month, u.prev0,
      coalesce(sum(t.amount) filter (where t.type = 'in' and t.category is distinct from 'repay'), 0) as income,
      greatest(0, coalesce(sum(t.amount) filter (where t.type = 'out'), 0)
                - coalesce(sum(t.amount) filter (where t.type = 'in' and t.category = 'repay'), 0)) as expense,
      count(t.id) as entries
    from users u
    left join public.transactions t
      on t.user_id = u.user_id and t.date >= u.m0 and t.date < u.m1
    group by u.user_id, u.m0, u.m1, u.month, u.prev0
  )
  select x.user_id, x.month, x.income, x.expense,
    array(
      select 'total' from public.goals g
      where g.user_id = x.user_id and g.expense_budget > 0 and x.expense > g.expense_budget
      union all
      select c.key from public.goals g cross join lateral jsonb_each_text(g.category_budgets) c
      where g.user_id = x.user_id and c.value ~ '^[0-9.]+$' and c.value::numeric > 0
        and (select coalesce(sum(t.amount), 0) from public.transactions t
             where t.user_id = x.user_id and t.type = 'out' and t.category = c.key
               and t.date >= x.m0 and t.date < x.m1)
            > c.value::numeric + case when c.key = any (g.rollover_keys) then public.category_carry(g.user_id, c.key, c.value::numeric, x.prev0, x.m0) else 0 end
    )
  from totals x
  where x.entries > 0
    and not exists (select 1 from public.month_summaries_sent s where s.user_id = x.user_id and s.month = x.month)
$$;

-- Replaced by the version that takes the month's bounds.
drop function public.category_carry(uuid, text, numeric, date);
