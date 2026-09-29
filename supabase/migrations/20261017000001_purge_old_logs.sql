-- The free database holds 500 MB, so keep only what's still read.
--
-- The "sent" tables only stop a push going out twice. Each is checked for
-- tomorrow's due date, today, or the current / previous month, so older rows
-- are never read again; log_reminders_sent alone gains a row per user per
-- day. A daily job clears them, and pg_cron's own run history (a row per job
-- run, kept forever by default).
--
-- Most transactions have no from_id / to_id (only transfers do), so those
-- two indexes only need the rows that have one.

create function public.purge_old_logs()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.reminders_sent where due_date < current_date - 7;
  delete from public.due_reminders_sent where due_date < current_date - 7;
  delete from public.log_reminders_sent where date < current_date - 7;
  delete from public.budget_alerts_sent where month < to_char(current_date - 70, 'YYYY-MM');
  delete from public.month_summaries_sent where month < to_char(current_date - 100, 'YYYY-MM');
$$;
revoke execute on function public.purge_old_logs() from public, anon, authenticated;
grant execute on function public.purge_old_logs() to service_role;

drop index public.transactions_from_idx;
drop index public.transactions_to_idx;
create index transactions_from_idx on public.transactions (from_id) where from_id is not null;
create index transactions_to_idx on public.transactions (to_id) where to_id is not null;

/* ---------- schedule ---------- */

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('purge-old-logs', '41 3 * * *', $$select public.purge_old_logs()$$);
select cron.schedule(
  'purge-cron-history',
  '43 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
