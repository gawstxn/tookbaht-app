-- Money friends pay back (income in the "repay" category) lowers what the
-- user spent instead of counting as income, matching summarize() in the app:
-- the bill was logged in full, but only the user's share was really spent.
-- Applies to the monthly summary and the overall-budget alert.

create or replace function public.pending_month_summaries()
returns table (user_id uuid, month text, income numeric, expense numeric, over_budget text[])
language sql
stable
security definer
set search_path = ''
as $$
  with users as (
    select p.id as user_id,
      (date_trunc('month', public.user_today(p.timezone)) - interval '1 month')::date as m0
    from public.profiles p
    where extract(day from public.user_today(p.timezone)) <= 3
      and p.deletion_requested_at is null
      and coalesce(p.settings ->> 'monthlySummary', 'true') <> 'false'
  ),
  totals as (
    select u.user_id, u.m0,
      coalesce(sum(t.amount) filter (where t.type = 'in' and t.category is distinct from 'repay'), 0) as income,
      greatest(0, coalesce(sum(t.amount) filter (where t.type = 'out'), 0)
                - coalesce(sum(t.amount) filter (where t.type = 'in' and t.category = 'repay'), 0)) as expense,
      count(t.id) as entries
    from users u
    left join public.transactions t
      on t.user_id = u.user_id and t.date >= u.m0 and t.date < (u.m0 + interval '1 month')::date
    group by u.user_id, u.m0
  )
  select x.user_id, to_char(x.m0, 'YYYY-MM'), x.income, x.expense,
    array(
      select 'total' from public.goals g
      where g.user_id = x.user_id and g.expense_budget > 0 and x.expense > g.expense_budget
      union all
      select c.key from public.goals g cross join lateral jsonb_each_text(g.category_budgets) c
      where g.user_id = x.user_id and c.value ~ '^[0-9.]+$' and c.value::numeric > 0
        and (select coalesce(sum(t.amount), 0) from public.transactions t
             where t.user_id = x.user_id and t.type = 'out' and t.category = c.key
               and t.date >= x.m0 and t.date < (x.m0 + interval '1 month')::date) > c.value::numeric
    )
  from totals x
  where x.entries > 0
    and not exists (select 1 from public.month_summaries_sent s where s.user_id = x.user_id and s.month = to_char(x.m0, 'YYYY-MM'))
$$;

create or replace function public.pending_budget_alerts()
returns table (user_id uuid, month text, budget_key text, level smallint, spent numeric, budget numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select p.id as user_id, date_trunc('month', public.user_today(p.timezone))::date as m0
    from public.profiles p
  ),
  lines as (
    select g.user_id, 'total'::text as budget_key, g.expense_budget as budget, g.alert_at_80
    from public.goals g where g.expense_budget > 0
    union all
    select g.user_id, c.key, c.value::numeric, g.alert_at_80
    from public.goals g cross join lateral jsonb_each_text(g.category_budgets) c
    where c.value ~ '^[0-9.]+$' and c.value::numeric > 0
  ),
  spend as (
    select l.user_id, l.budget_key, l.budget, l.alert_at_80, to_char(b.m0, 'YYYY-MM') as month,
      greatest(0, coalesce((select sum(case when t.type = 'out' then t.amount else -t.amount end) from public.transactions t
                where t.user_id = l.user_id
                  and t.date >= b.m0 and t.date < (b.m0 + interval '1 month')::date
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
