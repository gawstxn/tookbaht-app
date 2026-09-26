-- Per-user row caps, far above real use, so no one can fill the database
-- (and slow it down for everyone) by writing in a loop. Row-level security
-- already keeps each user to their own rows; this caps how many there can be.
-- Checked once per insert statement, so restoring a backup or syncing offline
-- entries (thousands of rows at once) stays fast.

create function public.enforce_row_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap integer := tg_argv[0]::integer;
  v_over uuid;
begin
  execute format(
    'select i.user_id from (select distinct user_id from inserted) i
     where (select count(*) from public.%I t where t.user_id = i.user_id) > $1 limit 1',
    tg_table_name
  ) into v_over using v_cap;
  if v_over is not null then
    raise exception 'row limit reached for %', tg_table_name using errcode = 'P0001', hint = 'row_limit';
  end if;
  return null;
end;
$$;
revoke execute on function public.enforce_row_cap() from public, anon, authenticated;

create trigger transactions_row_cap after insert on public.transactions
  referencing new table as inserted for each statement execute function public.enforce_row_cap('100000');
create trigger accounts_row_cap after insert on public.accounts
  referencing new table as inserted for each statement execute function public.enforce_row_cap('100');
create trigger subscriptions_row_cap after insert on public.subscriptions
  referencing new table as inserted for each statement execute function public.enforce_row_cap('300');
create trigger ious_row_cap after insert on public.ious
  referencing new table as inserted for each statement execute function public.enforce_row_cap('5000');
create trigger savings_goals_row_cap after insert on public.savings_goals
  referencing new table as inserted for each statement execute function public.enforce_row_cap('100');
create trigger push_subscriptions_row_cap after insert on public.push_subscriptions
  referencing new table as inserted for each statement execute function public.enforce_row_cap('20');
