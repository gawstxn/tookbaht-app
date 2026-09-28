-- Users can now rename themselves on the profile screen (1–40 characters,
-- trimmed). The app enforces that; this makes the database enforce it too, so
-- a direct API call can't store an empty or very long name.
--
-- A trigger rather than a check constraint: names that came from Google at
-- sign-up may be longer, and a constraint would reject every later update to
-- those rows (settings included). Only a change to the name itself is checked.

create function public.check_profile_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name and char_length(btrim(coalesce(new.name, ''))) not between 1 and 40 then
    raise exception 'name must be 1 to 40 characters' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_check_name
  before update of name on public.profiles
  for each row execute function public.check_profile_name();
