-- Alerts for the maintainers' Discord channel: an account writing far more than
-- a person would, a burst of sign-ups, a full database, a scheduled job that
-- stopped, what an admin did, and a short summary each morning.
--
-- An alert is a row here first. The key says what it is about, so the same
-- thing is only raised once; /api/cron/alerts posts the rows not sent yet and
-- marks them. Numbers and display names only, never what a user logged.

create table public.admin_alerts (
  key text primary key check (char_length(key) <= 120),
  kind text not null check (char_length(kind) <= 40),
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 2000),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index admin_alerts_unsent_idx on public.admin_alerts (created_at) where sent_at is null;

alter table public.admin_alerts enable row level security;
revoke all on public.admin_alerts from public, anon, authenticated, service_role;
-- The server adds the alerts it works out itself (jobs, database size, push) and marks rows sent.
grant select, insert on public.admin_alerts to service_role;
grant update (sent_at) on public.admin_alerts to service_role;

/* ---------- what the database can see for itself ---------- */

-- Looks back a day, so it finds the same things whether it runs every hour or
-- twice a day; the key keeps each to one alert a day (once a month for a full table).
create function public.collect_alerts(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day text := to_char(p_now at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
begin
  -- More entries in a day than a person types: a script writing in a loop.
  insert into public.admin_alerts (key, kind, data)
  select 'writes:' || t.user_id || ':' || v_day, 'writes', jsonb_build_object('name', p.name, 'count', count(*))
    from public.transactions t
    join public.profiles p on p.id = t.user_id
   where t.created_at > p_now - interval '1 day'
   group by t.user_id, p.name
  having count(*) > 2000
  on conflict (key) do nothing;

  -- An account that filled a table to its cap (the enforce_row_cap triggers).
  insert into public.admin_alerts (key, kind, data)
  select 'cap:' || c.user_id || ':' || c.tbl, 'cap', jsonb_build_object('name', p.name, 'table', c.tbl, 'count', c.n)
    from (
      select user_id, 'transactions' as tbl, count(*) as n from public.transactions group by user_id having count(*) >= 30000
      union all
      select user_id, 'accounts', count(*) from public.accounts group by user_id having count(*) >= 100
      union all
      select user_id, 'subscriptions', count(*) from public.subscriptions group by user_id having count(*) >= 300
      union all
      select user_id, 'ious', count(*) from public.ious group by user_id having count(*) >= 5000
      union all
      select user_id, 'savings_goals', count(*) from public.savings_goals group by user_id having count(*) >= 100
      union all
      select user_id, 'wishes', count(*) from public.wishes group by user_id having count(*) >= 2000
      union all
      select user_id, 'feedback', count(*) from public.feedback group by user_id having count(*) >= 100
    ) c
    join public.profiles p on p.id = c.user_id
  on conflict (key) do nothing;

  -- An account that used up its 20 problem reports for the day.
  insert into public.admin_alerts (key, kind, data)
  select 'fbspam:' || f.user_id || ':' || v_day, 'fbspam', jsonb_build_object('name', p.name, 'count', count(*))
    from public.feedback f
    join public.profiles p on p.id = f.user_id
   where f.created_at > p_now - interval '1 day'
   group by f.user_id, p.name
  having count(*) >= 20
  on conflict (key) do nothing;

  -- More than 20 new accounts within one hour: sign-ups by a bot.
  insert into public.admin_alerts (key, kind, data)
  select 'signups:' || to_char(h.hour at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24'), 'signups',
         jsonb_build_object('count', h.n, 'hour', to_char(h.hour at time zone 'Asia/Bangkok', 'HH24:00'))
    from (
      select date_trunc('hour', p.created_at) as hour, count(*) as n
        from public.profiles p
       where p.created_at > p_now - interval '1 day'
       group by 1
      having count(*) > 20
    ) h
  on conflict (key) do nothing;

  -- The morning summary, once a day from 08:00 Bangkok.
  if extract(hour from p_now at time zone 'Asia/Bangkok') >= 8 then
    insert into public.admin_alerts (key, kind, data)
    select 'summary:' || v_day, 'summary', jsonb_build_object(
        'users', count(*),
        'newDay', count(*) filter (where p.created_at > p_now - interval '1 day'),
        'activeDay', count(*) filter (where p.last_active_at > p_now - interval '1 day'),
        'suspended', count(*) filter (where p.suspended_at is not null),
        'feedbackOpen', (select count(*) from public.feedback f where f.resolved_at is null),
        'entriesDay', (select count(*) from public.transactions t where t.created_at > p_now - interval '1 day'),
        'dbBytes', pg_database_size(current_database()))
      from public.profiles p
    on conflict (key) do nothing;
  end if;
end;
$$;
revoke execute on function public.collect_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.collect_alerts(timestamptz) to service_role;

/* ---------- what an admin did ---------- */

-- Suspending and lifting now leave an alert, written here so it can't be
-- skipped by calling the function directly. Only when something changed.
create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_was boolean;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_suspended and exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin') then
    raise exception 'an admin cannot be suspended' using errcode = 'P0001', hint = 'is_admin';
  end if;
  select p.name, p.suspended_at is not null into v_name, v_was from public.profiles p where p.id = p_user for update;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  update public.profiles p
     set suspended_at = case when p_suspended then coalesce(p.suspended_at, now()) end,
         suspended_note = case when p_suspended then left(coalesce(p_note, ''), 200) else '' end
   where p.id = p_user;
  if v_was is distinct from p_suspended then
    insert into public.admin_alerts (key, kind, data)
    values ('admin:' || gen_random_uuid(), case when p_suspended then 'suspended' else 'lifted' end,
      jsonb_build_object(
        'name', v_name,
        'admin', (select a.name from public.profiles a where a.id = auth.uid()),
        'note', case when p_suspended then left(coalesce(p_note, ''), 200) else '' end));
  end if;
end;
$$;

/* ---------- keep a month ---------- */

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
$$;

/* ---------- send every hour ---------- */

-- Vercel's cron runs once a day on the free plan, so the database calls
-- /api/cron/alerts itself. It needs two secrets in Vault (README → Admin):
-- "app_url" and "cron_secret". Without them this does nothing, and alerts
-- still go out with the two daily Vercel jobs.
create function public.ping_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    return;
  end if;
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'app_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'cron_secret';
  if coalesce(v_url, '') !~ '^https://' or coalesce(v_secret, '') = '' then
    return;
  end if;
  perform net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 20000
  );
end;
$$;
revoke execute on function public.ping_alerts() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule('send-admin-alerts', '15 * * * *', $$select public.ping_alerts()$$);
