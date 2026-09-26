-- Trip / project tags on entries ("เที่ยวญี่ปุ่น"), and debts in both
-- directions: friends who owe the user, and friends the user owes.

alter table public.transactions
  add column tag text check (tag is null or char_length(tag) between 1 and 40);
create index transactions_tag_idx on public.transactions (user_id, tag) where tag is not null;

alter table public.ious
  add column direction text not null default 'owed_to_me' check (direction in ('owed_to_me', 'i_owe'));
