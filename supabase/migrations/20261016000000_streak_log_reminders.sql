-- The evening reminder now speaks to the logging streak (lib/streak.ts). The
-- app works the streak out on the device and keeps a summary in
-- profiles.settings.streak = {"n": length, "last": latest counted day,
-- "left": restores left this month}; entries only ever come from the app, so
-- the summary is current whenever the reminder runs.
--
-- Returned per user:
--   streak_state 'keep'    the streak runs through yesterday: log today to keep it
--                'restore' a day was missed but can still be restored
--                null      no streak worth mentioning (none yet, or only 1 day)
-- A "spent nothing today" confirmation (settings.noSpend) now also counts as
-- having logged today, like an entry.

drop function public.pending_log_reminders();

create function public.pending_log_reminders()
returns table (user_id uuid, date date, streak integer, streak_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    x.id,
    x.today,
    x.n,
    case
      when x.n < 2 or x.last is null then null
      when x.last = x.today - 1 then 'keep'
      when x.last >= x.today - 3 and x.left_ > 0 then 'restore'
    end
  from (
    select
      p.id,
      public.user_today(p.timezone) as today,
      coalesce((p.settings #>> '{streak,n}')::integer, 0) as n,
      (p.settings #>> '{streak,last}')::date as last,
      coalesce((p.settings #>> '{streak,left}')::integer, 0) as left_,
      p.settings,
      p.timezone
    from public.profiles p
    where p.settings ->> 'dailyReminder' = 'true'
      and p.deletion_requested_at is null
  ) x
  where
    -- Entries the user made today (charges logged automatically don't count).
    not exists (
      select 1 from public.transactions t
      where t.user_id = x.id and t.subscription_id is null
        and (t.created_at at time zone x.timezone)::date = x.today
    )
    -- Confirmed spending nothing today.
    and not coalesce(x.settings -> 'noSpend' @> jsonb_build_array(jsonb_build_object('d', x.today::text)), false)
    and not exists (select 1 from public.log_reminders_sent s where s.user_id = x.id and s.date = x.today)
$$;
revoke execute on function public.pending_log_reminders() from public, anon, authenticated;
grant execute on function public.pending_log_reminders() to service_role;
