do $$
begin
  alter table public.runs
    add column if not exists latitude double precision,
    add column if not exists longitude double precision;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'runs'
      and column_name = 'lat'
  ) then
    execute '
      update public.runs
      set latitude = coalesce(latitude, lat)
      where lat is not null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'runs'
      and column_name = 'lng'
  ) then
    execute '
      update public.runs
      set longitude = coalesce(longitude, lng)
      where lng is not null
    ';
  end if;
end
$$;
