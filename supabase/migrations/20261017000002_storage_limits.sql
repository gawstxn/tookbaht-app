-- Limits sized for the 500 MB free database. Each one sits well above real use
-- but bounds how much a single account can store (a transaction costs about
-- 330 bytes with its indexes).

/* ---------- transactions: 100,000 → 30,000 per user ---------- */

-- 30,000 is 10 entries a day for 8 years, about 10 MB. The old cap let one
-- account take 33 MB, so fifteen of them could fill the database.
drop trigger transactions_row_cap on public.transactions;
create trigger transactions_row_cap after insert on public.transactions
  referencing new table as inserted for each statement execute function public.enforce_row_cap('30000');

/* ---------- problem reports: 20 a day, 100 in all ---------- */

create trigger feedback_row_cap after insert on public.feedback
  referencing new table as inserted for each statement execute function public.enforce_row_cap('100');

/* ---------- columns that had no size limit ---------- */

-- Category keys are built-in names or "c-" plus 8 characters.
alter table public.transactions add constraint transactions_category_length
  check (category is null or char_length(category) <= 40);
alter table public.subscriptions add constraint subscriptions_category_length
  check (char_length(category) <= 40);

-- Settings grow by about 13 KB a year with the no-spend days; 256 KB is
-- decades of that plus custom categories.
alter table public.profiles add constraint profiles_settings_size
  check (octet_length(settings::text) <= 262144);

-- A budget per category, and the categories that roll over.
alter table public.goals add constraint goals_category_budgets_size
  check (octet_length(category_budgets::text) <= 16384);
alter table public.goals add constraint goals_rollover_keys_size
  check (cardinality(rollover_keys) <= 200);
