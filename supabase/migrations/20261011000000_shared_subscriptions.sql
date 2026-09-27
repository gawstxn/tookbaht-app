-- Sharing a subscription (Netflix, a family plan) with friends: each charge
-- the database logs also records what each friend owes for it, split evenly
-- with the user (leftover satang stay with the user).
alter table public.subscriptions
  add column split_with text[] not null default '{}'
    check (cardinality(split_with) <= 19 and array_position(split_with, null) is null and char_length(array_to_string(split_with, '')) <= 19 * 60);

create function public.split_shared_charge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_names text[];
  v_share numeric;
begin
  -- Only charges just logged: restoring a backup brings back old entries
  -- (with their created_at) together with the debts they already had.
  if new.created_at < now() - interval '5 minutes' then
    return null;
  end if;
  select array_agg(distinct trim(n)) into v_names
  from public.subscriptions s, unnest(s.split_with) n
  where s.id = new.subscription_id and s.user_id = new.user_id and s.entry_type = 'out' and char_length(trim(n)) between 1 and 60;
  if v_names is null then
    return null;
  end if;
  v_share := floor(new.amount * 100 / (cardinality(v_names) + 1)) / 100;
  if v_share <= 0 then
    return null;
  end if;
  insert into public.ious (user_id, direction, person, amount, note, date, transaction_id)
  select new.user_id, 'owed_to_me', n, v_share, left(new.title, 200), new.date, new.id
  from unnest(v_names) n;
  return null;
end;
$$;

create trigger transactions_split_shared
  after insert on public.transactions
  for each row when (new.subscription_id is not null and new.type = 'out')
  execute function public.split_shared_charge();

revoke execute on function public.split_shared_charge() from public, anon, authenticated;
