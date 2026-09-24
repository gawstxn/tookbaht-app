-- Only accept push endpoints from real browser push services, so a signed-in
-- user can't make the reminder cron send requests to arbitrary URLs.

create function public.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
$$;

-- Drop anything already stored that isn't a push service (none expected).
delete from public.push_subscriptions where not public.is_push_endpoint(endpoint);

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_check check (public.is_push_endpoint(endpoint));

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_push_endpoint(p_endpoint) then
    raise exception 'unsupported push endpoint';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent);
end;
$$;
