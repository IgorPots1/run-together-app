do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'runs'
  ) then
    execute 'alter table public.runs enable row level security';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'runs'
        and policyname = 'Runs are readable by everyone'
    ) then
      execute '
        create policy "Runs are readable by everyone"
          on public.runs
          for select
          using (true)
      ';
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'runs'
        and policyname = 'Users can create their own runs'
    ) then
      execute '
        create policy "Users can create their own runs"
          on public.runs
          for insert
          to authenticated
          with check (auth.uid() = creator_id)
      ';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'run_participants'
  ) then
    execute 'alter table public.run_participants enable row level security';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'run_participants'
        and policyname = 'Run participants are readable by everyone'
    ) then
      execute '
        create policy "Run participants are readable by everyone"
          on public.run_participants
          for select
          using (true)
      ';
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'run_participants'
        and policyname = 'Users can add themselves as participants'
    ) then
      execute '
        create policy "Users can add themselves as participants"
          on public.run_participants
          for insert
          to authenticated
          with check (auth.uid() = user_id)
      ';
    end if;
  end if;
end
$$;
