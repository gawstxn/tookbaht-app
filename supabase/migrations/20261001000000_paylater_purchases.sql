-- Pay-later purchases (SPayLater and similar): an installment plan remembers
-- the price it was bought at, so the account's available credit drops by the
-- full price at purchase and comes back as each installment is paid. Cards
-- and pay-later accounts can remember which account pays their bill.

alter table public.subscriptions
  -- Purchase price of an installment plan; installments × amount − principal is the interest.
  add column principal numeric(14, 2) check (principal > 0),
  add constraint subscriptions_principal_plan check (principal is null or (installments is not null and entry_type = 'out'));

alter table public.accounts
  -- Account the bill is usually paid from (pre-selected when recording a payment).
  add column bill_from_id uuid,
  add foreign key (bill_from_id, user_id) references public.accounts (id, user_id) on delete set null (bill_from_id),
  add constraint accounts_bill_from_self check (bill_from_id is null or bill_from_id <> id);

-- The day-before payment reminder counts installments falling due up to the
-- due date too: they are logged on their own date, so tomorrow's aren't in
-- the account's transactions yet.
create or replace function public.pending_due_reminders()
returns table (account_id uuid, user_id uuid, name text, owed numeric, due_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.user_id, a.name, o.owed + coalesce(u.upcoming, 0), d.due
  from public.accounts a
  join public.profiles p on p.id = a.user_id
  cross join lateral (select public.due_date_in_month(public.user_today(p.timezone) + 1, a.due_day) as due) d
  cross join lateral (select public.account_owed(a.id) as owed) o
  left join lateral (
    select sum(s.amount) as upcoming
    from public.subscriptions s
    cross join lateral generate_series(0, coalesce(s.installments, 0) - 1) as i
    where s.account_id = a.id
      and s.installments is not null
      and s.entry_type = 'out'
      and s.auto_log
      and not s.paused
      and public.billing_date(s.start_date, s.cycle, i) > public.user_today(p.timezone)
      and public.billing_date(s.start_date, s.cycle, i) <= d.due
  ) u on true
  where a.due_day is not null
    and a.archived_at is null
    and d.due = public.user_today(p.timezone) + 1
    and o.owed + coalesce(u.upcoming, 0) > 0
    and not exists (select 1 from public.due_reminders_sent r where r.account_id = a.id and r.due_date = d.due)
$$;
revoke execute on function public.pending_due_reminders() from public, anon, authenticated;
grant execute on function public.pending_due_reminders() to service_role;
