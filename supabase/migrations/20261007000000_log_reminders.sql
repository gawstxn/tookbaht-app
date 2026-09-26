-- Evening nudge (20:00 Bangkok, see vercel.json) for users who turned it on
-- (profiles.settings.dailyReminder) and logged nothing themselves today.

create table public.log_reminders_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.log_reminders_sent enable row level security;
-- No policies: only the service role (which bypasses RLS) uses this table.
grant select, insert, delete on public.log_reminders_sent to service_role;

create function public.pending_log_reminders()
returns table (user_id uuid, date date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, public.user_today(p.timezone)
  from public.profiles p
  where p.settings ->> 'dailyReminder' = 'true'
    and p.deletion_requested_at is null
    -- Entries the user made today (charges logged automatically don't count).
    and not exists (
      select 1 from public.transactions t
      where t.user_id = p.id and t.subscription_id is null
        and (t.created_at at time zone p.timezone)::date = public.user_today(p.timezone)
    )
    and not exists (select 1 from public.log_reminders_sent s where s.user_id = p.id and s.date = public.user_today(p.timezone))
$$;
revoke execute on function public.pending_log_reminders() from public, anon, authenticated;
grant execute on function public.pending_log_reminders() to service_role;
