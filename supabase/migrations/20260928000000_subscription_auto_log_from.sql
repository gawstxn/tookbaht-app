-- Subscriptions can start in the past (e.g. one you've had for a year), but
-- auto-log shouldn't back-fill every earlier charge. Log only from the day
-- the subscription was added, or from when it was resumed / auto-log turned on.

alter table public.subscriptions
  add column auto_log_from date not null default ((now() at time zone 'Asia/Bangkok')::date);

-- Existing rows keep their previous behaviour (log from the start date).
update public.subscriptions set auto_log_from = start_date;

create function public.subscriptions_auto_log_from()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date;
begin
  select public.user_today(p.timezone) into v_today from public.profiles p where p.id = new.user_id;
  v_today := coalesce(v_today, (now() at time zone 'Asia/Bangkok')::date);
  if tg_op = 'INSERT' then
    new.auto_log_from := v_today;
  elsif (old.paused and not new.paused) or (not old.auto_log and new.auto_log) then
    -- Charges that fell while paused / off aren't logged afterwards.
    new.auto_log_from := greatest(old.auto_log_from, v_today);
  else
    new.auto_log_from := old.auto_log_from;
  end if;
  return new;
end;
$$;

create trigger subscriptions_auto_log_from
  before insert or update on public.subscriptions
  for each row execute function public.subscriptions_auto_log_from();

create or replace function public.log_due_subscriptions(p_user uuid default null)
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
    and d.due >= s.auto_log_from
    and d.due <= public.user_today(p.timezone)
  on conflict (subscription_id, date) do nothing
  returning *
$$;
