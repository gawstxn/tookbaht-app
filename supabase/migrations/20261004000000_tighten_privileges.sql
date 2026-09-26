-- Supabase grants every privilege on new tables to the API roles by default
-- (TRUNCATE, REFERENCES and TRIGGER included; TRUNCATE ignores row-level
-- security). Reset each table to exactly what the app uses, stop the default
-- for future tables, and cap problem reports per user.

/* ---------- table privileges ---------- */

revoke all on
  public.profiles, public.accounts, public.subscriptions, public.transactions, public.goals,
  public.ious, public.savings_goals, public.feedback, public.push_subscriptions, public.exchange_rates,
  public.reminders_sent, public.due_reminders_sent, public.budget_alerts_sent, public.month_summaries_sent
from anon, authenticated;

grant select, insert, update, delete on public.accounts, public.subscriptions, public.transactions, public.ious, public.savings_goals to authenticated;
grant select, insert, update on public.goals to authenticated;
-- Only the display name and app settings are the user's to change (not email, time zone or deletion state).
grant select, update (name, settings) on public.profiles to authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert on public.feedback to authenticated;
grant select on public.exchange_rates to authenticated;

-- New tables start with no API access; each migration grants what it needs.
alter default privileges in schema public revoke all on tables from anon, authenticated;

/* ---------- problem reports: at most 20 a day per user ---------- */

create function public.limit_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.feedback f where f.user_id = new.user_id and f.created_at > now() - interval '1 day') >= 20 then
    raise exception 'feedback limit reached' using errcode = 'P0001', hint = 'feedback_limit';
  end if;
  return new;
end;
$$;
revoke execute on function public.limit_feedback() from public, anon, authenticated;

create trigger feedback_daily_limit
  before insert on public.feedback
  for each row execute function public.limit_feedback();
