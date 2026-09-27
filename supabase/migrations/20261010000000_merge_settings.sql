-- Account-wide settings are changed one key at a time. Writing the whole
-- settings object let a second device holding an older copy wipe what the
-- first had just saved (e.g. the user's own categories). merge_settings only
-- touches the keys in the patch; a null value removes that key.
-- Security invoker: the existing column grant and "profiles: update own"
-- policy still decide what the caller may change.
create function public.merge_settings(patch jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  update public.profiles
     set settings = jsonb_strip_nulls(settings || patch)
   where id = (select auth.uid())
     and jsonb_typeof(patch) = 'object'
  returning settings;
$$;

revoke execute on function public.merge_settings(jsonb) from public, anon;
grant execute on function public.merge_settings(jsonb) to authenticated;
