-- Admin health screen: the scheduled database jobs (auto-log, purges) and when
-- each last ran, plus the database size. The rest of the checks (keys, push,
-- the Discord webhooks) are done by /api/admin/health.

-- The facts, for the server (the alerts job reads them with the secret key).
create function public.system_health()
returns table (job text, schedule text, active boolean, last_status text, last_run timestamptz, failed_week bigint,
               db_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- First row: the database itself. The job columns stay null.
  return query select null::text, null::text, null::boolean, null::text, null::timestamptz, null::bigint,
    pg_database_size(current_database());
  -- pg_cron isn't installed everywhere (the tests run without it).
  if to_regclass('cron.job') is null or to_regclass('cron.job_run_details') is null then
    return;
  end if;
  -- Run history is kept for 7 days (purge-cron-history), so "failed" counts the last week.
  return query
    select j.jobname::text, j.schedule::text, j.active, l.status::text, coalesce(l.end_time, l.start_time),
      (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed'),
      null::bigint
    from cron.job j
    left join lateral (
      select d.status, d.start_time, d.end_time
      from cron.job_run_details d
      where d.jobid = j.jobid and d.status in ('succeeded', 'failed')
      order by d.start_time desc
      limit 1
    ) l on true
    order by j.jobname;
end;
$$;

revoke execute on function public.system_health() from public, anon, authenticated;
grant execute on function public.system_health() to service_role;

-- The same, for an admin's screen.
create function public.admin_health()
returns table (job text, schedule text, active boolean, last_status text, last_run timestamptz, failed_week bigint,
               db_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query select * from public.system_health();
end;
$$;

revoke execute on function public.admin_health() from public, anon, authenticated;
-- Signed-in users may call it; it refuses anyone who isn't an admin.
grant execute on function public.admin_health() to authenticated;
