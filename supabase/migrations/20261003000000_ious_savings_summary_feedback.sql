-- Money friends owe (split bills), savings goals, the monthly summary push,
-- and in-app feedback.

/* ---------- money friends owe ---------- */

-- Lets other tables point at a transaction of the same user.
alter table public.transactions add constraint transactions_id_user_key unique (id, user_id);

create table public.ious (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Who owes the money: a name the user types, nothing else about them.
  person text not null check (char_length(person) between 1 and 60),
  amount numeric(14, 2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 200),
  date date not null,
  -- The bill it came from; deleting that entry keeps the debt.
  transaction_id uuid,
  -- Set when the friend paid it back.
  settled_on date,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete set null (transaction_id)
);
create index ious_user_idx on public.ious (user_id, settled_on);
create index ious_transaction_idx on public.ious (transaction_id);

/* ---------- savings goals ---------- */

-- "เที่ยวญี่ปุ่น ฿40,000 ภายในมี.ค.": progress is the linked account's balance,
-- or an amount the user adds to by hand.
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  target numeric(14, 2) not null check (target > 0),
  saved numeric(14, 2) not null default 0 check (saved >= 0),
  deadline date,
  account_id uuid,
  tone text not null default '#33558f' check (tone ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  -- Deleting the account turns the goal back into a manual one.
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id)
);
create index savings_goals_user_idx on public.savings_goals (user_id);
create index savings_goals_account_idx on public.savings_goals (account_id);

/* ---------- monthly summary push ---------- */

create table public.month_summaries_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, month)
);

-- Last month's totals for users in the first three days of a new month (their
-- local date) who logged something that month and haven't had the summary.
-- over_budget lists the budgets that month went over ('total' or a category).
-- Users can turn it off with profiles.settings.monthlySummary = false.
create function public.pending_month_summaries()
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
      coalesce(sum(t.amount) filter (where t.type = 'in'), 0) as income,
      coalesce(sum(t.amount) filter (where t.type = 'out'), 0) as expense,
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

/* ---------- feedback ---------- */

-- "แจ้งปัญหา" from the profile screen: the message plus what helps reproduce it.
-- Users can send but not read back; the maintainer reads it in the dashboard.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  app_version text not null default '' check (char_length(app_version) <= 40),
  page text not null default '' check (char_length(page) <= 200),
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);

/* ---------- privileges and row level security ---------- */

revoke all on public.ious, public.savings_goals, public.feedback, public.month_summaries_sent from anon;
grant select, insert, update, delete on public.ious, public.savings_goals to authenticated;
grant insert on public.feedback to authenticated;
revoke all on public.month_summaries_sent from authenticated;
grant select, insert, delete on public.month_summaries_sent to service_role;
grant select on public.feedback to service_role;

alter table public.ious enable row level security;
alter table public.savings_goals enable row level security;
alter table public.feedback enable row level security;
alter table public.month_summaries_sent enable row level security;

create policy "ious: own rows" on public.ious
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "savings_goals: own rows" on public.savings_goals
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "feedback: send own" on public.feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);

revoke execute on function public.pending_month_summaries() from public, anon, authenticated;
grant execute on function public.pending_month_summaries() to service_role;
