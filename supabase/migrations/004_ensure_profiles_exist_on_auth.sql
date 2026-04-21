create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'name',
          new.raw_user_meta_data ->> 'full_name'
        )
      ),
      ''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user_profile();

insert into public.profiles (id, name)
select
  au.id,
  nullif(
    btrim(
      coalesce(
        au.raw_user_meta_data ->> 'name',
        au.raw_user_meta_data ->> 'full_name'
      )
    ),
    ''
  )
from auth.users au
left join public.profiles profiles on profiles.id = au.id
where profiles.id is null
on conflict (id) do nothing;
