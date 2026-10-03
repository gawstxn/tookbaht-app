-- Errors users run into but never report: the app sends what went wrong
-- (the message, the top of the stack, the screen, the version, the device,
-- never what the user logged) and the maintainers see it in Discord.
--
-- One row per error per day, however many times or to however many people it
-- happens: the row counts them. Only the server writes here (report_error is
-- for the service role), after scrubbing the text.

create table public.error_reports (
  fingerprint text not null check (char_length(fingerprint) <= 40),
  day date not null,
  source text not null check (char_length(source) <= 20),
  message text not null check (char_length(message) <= 300),
  stack text not null default '' check (char_length(stack) <= 1000),
  page text not null default '' check (char_length(page) <= 200),
  app_version text not null default '' check (char_length(app_version) <= 40),
  device text not null default '' check (char_length(device) <= 60),
  count integer not null default 1,
  users integer not null default 0,
  -- The count when the maintainers were last told; they are told again at ten times that.
  notified_count integer not null default 0,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (fingerprint, day)
);
create index error_reports_day_idx on public.error_reports (day);

-- Who met an error that day: counts people, and caps what one account can report.
create table public.error_report_users (
  fingerprint text not null,
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  n integer not null default 1,
  primary key (fingerprint, day, user_id),
  foreign key (fingerprint, day) references public.error_reports (fingerprint, day) on delete cascade
);
create index error_report_users_user_idx on public.error_report_users (user_id, day);

alter table public.error_reports enable row level security;
alter table public.error_report_users enable row level security;
revoke all on public.error_reports, public.error_report_users from public, anon, authenticated, service_role;

-- Record one occurrence. Returns the totals for the day and whether to tell
-- the maintainers now: the first time, then at 10, 100, 1,000 occurrences.
-- Refused quietly (no row returned) past the limits: 100 different errors a
-- day in all, and per account 20 different errors a day, 50 of each.
create function public.report_error(
  p_user uuid, p_fingerprint text, p_source text, p_message text, p_stack text, p_page text, p_app_version text,
  p_device text
)
returns table (count integer, users integer, notify boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Bangkok')::date;
  v_seen integer;
  v_known boolean;
  v_row public.error_reports;
  v_notify boolean;
begin
  select exists (select 1 from public.error_reports e where e.fingerprint = p_fingerprint and e.day = v_day) into v_known;
  if not v_known and (select count(*) from public.error_reports e where e.day = v_day) >= 100 then
    return;
  end if;
  if p_user is not null then
    select u.n into v_seen from public.error_report_users u
     where u.fingerprint = p_fingerprint and u.day = v_day and u.user_id = p_user;
    if v_seen >= 50 then
      return;
    end if;
    if v_seen is null
       and (select count(*) from public.error_report_users u where u.user_id = p_user and u.day = v_day) >= 20 then
      return;
    end if;
  end if;

  insert into public.error_reports as e (fingerprint, day, source, message, stack, page, app_version, device)
  values (p_fingerprint, v_day, left(p_source, 20), left(p_message, 300), left(coalesce(p_stack, ''), 1000),
          left(coalesce(p_page, ''), 200), left(coalesce(p_app_version, ''), 40), left(coalesce(p_device, ''), 60))
  on conflict (fingerprint, day) do update set count = e.count + 1, last_at = now()
  returning e.* into v_row;

  if p_user is not null then
    insert into public.error_report_users as u (fingerprint, day, user_id) values (p_fingerprint, v_day, p_user)
    on conflict (fingerprint, day, user_id) do update set n = u.n + 1;
    if v_seen is null then
      update public.error_reports e set users = e.users + 1
       where e.fingerprint = p_fingerprint and e.day = v_day
      returning e.* into v_row;
    end if;
  end if;

  v_notify := v_row.notified_count = 0 or v_row.count >= v_row.notified_count * 10;
  if v_notify then
    update public.error_reports e set notified_count = v_row.count
     where e.fingerprint = p_fingerprint and e.day = v_day;
  end if;
  return query select v_row.count, v_row.users, v_notify;
end;
$$;
revoke execute on function public.report_error(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.report_error(uuid, text, text, text, text, text, text, text) to service_role;

/* ---------- keep two weeks ---------- */

create or replace function public.purge_old_logs()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.reminders_sent where due_date < current_date - 7;
  delete from public.due_reminders_sent where due_date < current_date - 7;
  delete from public.renewal_reviews_sent where due_date < current_date - 7;
  delete from public.log_reminders_sent where date < current_date - 7;
  delete from public.budget_alerts_sent where month < to_char(current_date - 70, 'YYYY-MM');
  delete from public.month_summaries_sent where month < to_char(current_date - 100, 'YYYY-MM');
  -- After a month a condition that still holds is raised again.
  delete from public.admin_alerts where created_at < now() - interval '30 days';
  delete from public.error_reports where day < current_date - 14;
$$;
