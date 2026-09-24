-- ทุกบาท — initial schema.
-- Every row belongs to one auth user (user_id). RLS limits each user to their
-- own rows, and composite foreign keys (id, user_id) stop a row from pointing
-- at another user's account or subscription.

create type public.account_kind as enum ('bank', 'saving', 'credit', 'cash');
create type public.tx_type as enum ('in', 'out', 'move');
create type public.billing_cycle as enum ('week', 'month', 'year');

/* ---------- tables ---------- */

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  -- Per-user app settings, e.g. {"faceLock": false}.
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind public.account_kind not null,
  -- Starting balance (for credit cards: the credit limit).
  opening_balance numeric(14, 2) not null default 0,
  mono text not null default '' check (char_length(mono) <= 4),
  tone text not null default '#1c1e1b' check (tone ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  amount numeric(14, 2) not null check (amount > 0),
  cycle public.billing_cycle not null,
  start_date date not null,
  account_id uuid not null,
  category text not null,
  remind boolean not null default true,
  auto_log boolean not null default true,
  paused boolean not null default false,
  tone text not null default '#1c1e1b' check (tone ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.tx_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null,
  title text not null default '' check (char_length(title) <= 120),
  note text check (char_length(note) <= 500),
  -- Category key — for "in" and "out" only.
  category text,
  -- Account for "in" / "out".
  account_id uuid,
  -- Source and destination for "move".
  from_id uuid,
  to_id uuid,
  -- Set when the entry was logged automatically from a subscription.
  subscription_id uuid,
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id),
  foreign key (from_id, user_id) references public.accounts (id, user_id),
  foreign key (to_id, user_id) references public.accounts (id, user_id),
  -- Deleting a subscription keeps the expenses it already logged.
  foreign key (subscription_id, user_id) references public.subscriptions (id, user_id)
    on delete set null (subscription_id),
  constraint transactions_shape check (
    (type in ('in', 'out') and account_id is not null and from_id is null and to_id is null)
    or (type = 'move' and account_id is null and category is null
        and from_id is not null and to_id is not null and from_id <> to_id)
  ),
  -- A subscription is logged at most once per billing date, across all devices.
  unique (subscription_id, date)
);

create table public.goals (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  income_target numeric(14, 2) not null default 0 check (income_target >= 0),
  expense_budget numeric(14, 2) not null default 0 check (expense_budget >= 0),
  -- {"food": 8000, "shop": 5000, ...}
  category_budgets jsonb not null default '{}'::jsonb,
  alert_at_80 boolean not null default true,
  updated_at timestamptz not null default now()
);

create index accounts_user_idx on public.accounts (user_id, sort_order);
create index subscriptions_user_idx on public.subscriptions (user_id);
create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_from_idx on public.transactions (from_id);
create index transactions_to_idx on public.transactions (to_id);
create index subscriptions_account_idx on public.subscriptions (account_id);

/* ---------- new user bootstrap ---------- */

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(new.email, '')
  );
  insert into public.goals (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* ---------- account deletion ---------- */

-- Deletes the calling user; every table cascades from auth.users.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

/* ---------- privileges ---------- */

revoke all on public.profiles, public.accounts, public.subscriptions, public.transactions, public.goals from anon;
grant select, update (name, settings) on public.profiles to authenticated;
grant select, insert, update, delete on public.accounts, public.subscriptions, public.transactions to authenticated;
grant select, insert, update on public.goals to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

/* ---------- row level security ---------- */

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "accounts: own rows" on public.accounts
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "subscriptions: own rows" on public.subscriptions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "transactions: own rows" on public.transactions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "goals: read own" on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals: insert own" on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals: update own" on public.goals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
