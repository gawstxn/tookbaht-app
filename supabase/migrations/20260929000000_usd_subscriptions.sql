-- USD-priced subscriptions. Prices stay in their own currency; charges are
-- logged in baht at the day's rate plus the paying card's FX fee, and keep
-- the original amount and rate so the entry can be checked or corrected.

/* ---------- exchange rates ---------- */

-- THB per 1 unit of `currency`, one row per day (ECB reference rates via Frankfurter).
create table public.exchange_rates (
  currency text not null check (currency in ('USD')),
  date date not null,
  rate numeric(12, 6) not null check (rate > 0),
  primary key (currency, date)
);

alter table public.exchange_rates enable row level security;
revoke all on public.exchange_rates from anon, authenticated;
grant select on public.exchange_rates to authenticated;
grant select, insert, update on public.exchange_rates to service_role;
-- Reference data, not personal: any signed-in user may read it.
create policy "exchange_rates: read" on public.exchange_rates for select to authenticated using (true);

-- Latest rate on or before p_date (null when none is stored yet).
create function public.thb_rate(p_currency text, p_date date)
returns numeric
language sql
stable
set search_path = ''
as $$
  select rate from public.exchange_rates
  where currency = p_currency and date <= p_date
  order by date desc
  limit 1
$$;

/* ---------- columns ---------- */

alter table public.subscriptions
  add column currency text not null default 'THB' check (currency in ('THB', 'USD'));

-- Card/bank foreign-transaction fee in percent, applied on top of the rate.
alter table public.accounts
  add column fx_fee_pct numeric(5, 2) not null default 0 check (fx_fee_pct between 0 and 10);

alter table public.transactions
  add column orig_amount numeric(14, 2) check (orig_amount > 0),
  add column orig_currency text check (orig_currency in ('USD')),
  add column fx_rate numeric(12, 6) check (fx_rate > 0),
  add constraint transactions_fx_shape check (
    (orig_amount is null and orig_currency is null and fx_rate is null)
    or (orig_amount is not null and orig_currency is not null and fx_rate is not null)
  );

/* ---------- auto-log in baht ---------- */

-- USD charges: amount × rate on the billing date × (1 + card fee). Skipped
-- until a rate exists, so nothing is logged with a made-up conversion.
create or replace function public.log_due_subscriptions(p_user uuid default null)
returns setof public.transactions
language sql
security definer
set search_path = ''
as $$
  insert into public.transactions (user_id, type, amount, date, title, category, account_id, subscription_id, orig_amount, orig_currency, fx_rate)
  select
    s.user_id,
    'out',
    case when s.currency = 'THB' then s.amount else round(s.amount * r.rate * (1 + a.fx_fee_pct / 100), 2) end,
    d.due,
    s.name,
    'sub',
    s.account_id,
    s.id,
    case when s.currency = 'THB' then null else s.amount end,
    case when s.currency = 'THB' then null else s.currency end,
    case when s.currency = 'THB' then null else r.rate end
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  join public.accounts a on a.id = s.account_id
  cross join lateral (
    -- Weeks elapsed bounds the number of billing dates for every cycle.
    select public.billing_date(s.start_date, s.cycle, i) as due
    from generate_series(0, (public.user_today(p.timezone) - s.start_date) / 7 + 1) as i
  ) d
  left join lateral (select public.thb_rate(s.currency, d.due) as rate) r on s.currency <> 'THB'
  where s.auto_log
    and not s.paused
    and (p_user is null or s.user_id = p_user)
    and d.due >= s.auto_log_from
    and d.due <= public.user_today(p.timezone)
    and (s.currency = 'THB' or r.rate is not null)
  on conflict (subscription_id, date) do nothing
  returning *
$$;

/* ---------- reminders carry the currency ---------- */

drop function public.pending_reminders();
create function public.pending_reminders()
returns table (subscription_id uuid, user_id uuid, name text, amount numeric, currency text, due_date date, account_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.name, s.amount, s.currency, d.due, a.name
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
revoke execute on function public.pending_reminders() from public, anon, authenticated;
grant execute on function public.pending_reminders() to service_role;
