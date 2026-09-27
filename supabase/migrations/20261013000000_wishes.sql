-- Wishlist: things the user wants, parked for a few days before buying.
-- Bought ones can point at the expense they became; skipped ones add up to
-- money the user didn't spend.
create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  price numeric(14, 2) not null check (price > 0),
  note text not null default '' check (char_length(note) <= 200),
  -- The day the user said they'd decide.
  decide_on date not null,
  status text not null default 'waiting' check (status in ('waiting', 'bought', 'skipped')),
  decided_on date,
  transaction_id uuid,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (transaction_id, user_id) references public.transactions (id, user_id) on delete set null (transaction_id),
  constraint wishes_decided check ((status = 'waiting') = (decided_on is null))
);
create index wishes_user_idx on public.wishes (user_id, status);
create index wishes_transaction_idx on public.wishes (transaction_id);

revoke all on public.wishes from anon;
grant select, insert, update, delete on public.wishes to authenticated;

alter table public.wishes enable row level security;
create policy "wishes: own rows" on public.wishes
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger wishes_row_cap after insert on public.wishes
  referencing new table as inserted for each statement execute function public.enforce_row_cap('2000');
