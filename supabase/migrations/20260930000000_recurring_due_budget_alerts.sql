-- Recurring entries (salary, rent, installments) on the subscription machinery,
-- payment due days for cards / pay-later accounts, and push alerts for those
-- due days and for budgets nearing or passing their limit.

/* ---------- recurring entries ---------- */

-- A "subscription" row is now any scheduled entry. kind = 'subscription' keeps
-- today's behaviour (an expense in the "sub" category); 'recurring' logs its
-- own type and category: income (salary), an expense (rent) or a transfer.
alter table public.subscriptions
  add column kind text not null default 'subscription' check (kind in ('subscription', 'recurring')),
  add column entry_type public.tx_type not null default 'out',
  -- Destination of a recurring transfer; account_id is the source.
  add column to_account_id uuid,
  -- Number of charges for an installment plan (ผ่อน 3 งวด); null = no end.
  add column installments integer check (installments between 1 and 120),
  add foreign key (to_account_id, user_id) references public.accounts (id, user_id),
  add constraint subscriptions_entry_shape check (
    (kind = 'subscription' and entry_type = 'out' and to_account_id is null)
    or (kind = 'recurring' and entry_type in ('in', 'out') and to_account_id is null)
    or (kind = 'recurring' and entry_type = 'move' and to_account_id is not null and to_account_id <> account_id)
  ),
  -- Foreign prices are for subscriptions only.
  add constraint subscriptions_currency_kind check (currency = 'THB' or kind = 'subscription');

create index subscriptions_to_account_idx on public.subscriptions (to_account_id);

-- Log due entries up to each user's local today. Installment plans stop after
-- their last charge, counted from the start date even if earlier charges were
-- never logged (auto_log_from still prevents back-filling them).
create or replace function public.log_due_subscriptions(p_user uuid default null)
returns setof public.transactions
language sql
security definer
set search_path = ''
as $$
  insert into public.transactions (user_id, type, amount, date, title, category, account_id, from_id, to_id, subscription_id, orig_amount, orig_currency, fx_rate)
  select
    s.user_id,
    s.entry_type,
    case when s.currency = 'THB' then s.amount else round(s.amount * r.rate * (1 + a.fx_fee_pct / 100), 2) end,
    d.due,
    s.name,
    case when s.entry_type = 'move' then null when s.kind = 'subscription' then 'sub' else s.category end,
    case when s.entry_type = 'move' then null else s.account_id end,
    case when s.entry_type = 'move' then s.account_id end,
    case when s.entry_type = 'move' then s.to_account_id end,
    s.id,
    case when s.currency = 'THB' then null else s.amount end,
    case when s.currency = 'THB' then null else s.currency end,
    case when s.currency = 'THB' then null else r.rate end
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  join public.accounts a on a.id = s.account_id
  cross join lateral (
    -- Weeks elapsed bounds the number of billing dates for every cycle.
    select i, public.billing_date(s.start_date, s.cycle, i) as due
    from generate_series(0, (public.user_today(p.timezone) - s.start_date) / 7 + 1) as i
  ) d
  left join lateral (select public.thb_rate(s.currency, d.due) as rate) r on s.currency <> 'THB'
  where s.auto_log
    and not s.paused
    and (p_user is null or s.user_id = p_user)
    and (s.installments is null or d.i < s.installments)
    and d.due >= s.auto_log_from
    and d.due <= public.user_today(p.timezone)
    and (s.currency = 'THB' or r.rate is not null)
  on conflict (subscription_id, date) do nothing
  returning *
$$;

-- Reminders the day before a charge: subscriptions, recurring expenses and
-- transfers (not income), with the installment number for plans.
drop function public.pending_reminders();
create function public.pending_reminders()
returns table (subscription_id uuid, user_id uuid, name text, amount numeric, currency text, due_date date, account_name text,
               kind text, installment_no integer, installments integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.name, s.amount, s.currency, d.due, a.name, s.kind, d.i + 1, s.installments
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

/* ---------- payment due day for cards and pay-later ---------- */

-- Day of the month the bill must be paid by (clamped to short months).
alter table public.accounts
  add column due_day smallint check (due_day between 1 and 31),
  add constraint accounts_due_day_credit check (due_day is null or kind = 'credit');

-- The due date in the month of p_day: the due day, or the month's last day.
create function public.due_date_in_month(p_day date, p_due_day integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select (date_trunc('month', p_day)::date + (least(p_due_day, extract(day from (date_trunc('month', p_day) + interval '1 month - 1 day'))::integer) - 1))
$$;

-- What a card or pay-later account owes: spending on it less money paid in.
create function public.account_owed(p_account uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(case
    when t.type = 'out' and t.account_id = p_account then t.amount
    when t.type = 'in' and t.account_id = p_account then -t.amount
    when t.type = 'move' and t.from_id = p_account then t.amount
    when t.type = 'move' and t.to_id = p_account then -t.amount
  end), 0)
  from public.transactions t
  where p_account in (t.account_id, t.from_id, t.to_id)
$$;

create table public.due_reminders_sent (
  account_id uuid not null references public.accounts (id) on delete cascade,
  due_date date not null,
  sent_at timestamptz not null default now(),
  primary key (account_id, due_date)
);

-- Accounts whose payment is due tomorrow (user's local date) with something owed.
create function public.pending_due_reminders()
returns table (account_id uuid, user_id uuid, name text, owed numeric, due_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.user_id, a.name, o.owed, d.due
  from public.accounts a
  join public.profiles p on p.id = a.user_id
  cross join lateral (select public.due_date_in_month(public.user_today(p.timezone) + 1, a.due_day) as due) d
  cross join lateral (select public.account_owed(a.id) as owed) o
  where a.due_day is not null
    and a.archived_at is null
    and d.due = public.user_today(p.timezone) + 1
    and o.owed > 0
    and not exists (select 1 from public.due_reminders_sent r where r.account_id = a.id and r.due_date = d.due)
$$;

/* ---------- budget alerts ---------- */

-- level 80 = passed 80% (only when goals.alert_at_80), 100 = over budget.
create table public.budget_alerts_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  budget_key text not null,
  level smallint not null check (level in (80, 100)),
  sent_at timestamptz not null default now(),
  primary key (user_id, month, budget_key, level)
);

-- This month's budgets (overall = 'total', or a category key) that reached a
-- level not yet announced. Only the highest new level per budget is returned.
create function public.pending_budget_alerts()
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
      coalesce((select sum(t.amount) from public.transactions t
                where t.user_id = l.user_id and t.type = 'out'
                  and t.date >= b.m0 and t.date < (b.m0 + interval '1 month')::date
                  and (l.budget_key = 'total' or t.category = l.budget_key)), 0) as spent
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

/* ---------- privileges ---------- */

revoke all on public.due_reminders_sent, public.budget_alerts_sent from anon, authenticated;
grant select, insert, delete on public.due_reminders_sent, public.budget_alerts_sent to service_role;
alter table public.due_reminders_sent enable row level security;
alter table public.budget_alerts_sent enable row level security;
-- No policies: only the service role (which bypasses RLS) uses these tables.

revoke execute on function public.pending_reminders(), public.pending_due_reminders(), public.pending_budget_alerts() from public, anon, authenticated;
grant execute on function public.pending_reminders(), public.pending_due_reminders(), public.pending_budget_alerts() to service_role;
revoke execute on function public.account_owed(uuid) from public, anon, authenticated;
grant execute on function public.account_owed(uuid) to service_role;
