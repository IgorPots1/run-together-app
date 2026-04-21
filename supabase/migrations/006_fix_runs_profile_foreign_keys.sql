do $$
declare
  runs_creator_constraint_name text;
  runs_creator_constraint_target regclass;
  runs_creator_confdeltype "char";
  runs_creator_confupdtype "char";
  runs_orphan_count bigint;
  runs_orphan_sample_ids uuid[];
  runs_orphan_sample_creator_ids uuid[];

  run_participants_user_constraint_name text;
  run_participants_user_constraint_target regclass;
  run_participants_user_confdeltype "char";
  run_participants_user_confupdtype "char";
  run_participants_orphan_count bigint;
  run_participants_orphan_sample_keys text[];
  run_participants_orphan_sample_user_ids uuid[];
begin
  if (
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('runs', 'run_participants')
    )
    and not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'profiles'
    )
  ) then
    raise exception using
      message = 'Cannot repoint run foreign keys to public.profiles(id): public.profiles does not exist. Create/sync public.profiles first, then rerun this migration.';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'runs'
  ) then
    insert into public.profiles (id, name)
    select distinct
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
    from public.runs r
    join auth.users au on au.id = r.creator_id
    left join public.profiles p on p.id = au.id
    where r.creator_id is not null
      and p.id is null
    on conflict (id) do nothing;

    select count(*)
      into runs_orphan_count
    from public.runs r
    left join public.profiles p on p.id = r.creator_id
    where r.creator_id is not null
      and p.id is null;

    select coalesce(array_agg(run_id order by run_id), '{}'::uuid[]),
           coalesce(array_agg(creator_id order by creator_id), '{}'::uuid[])
      into runs_orphan_sample_ids
         , runs_orphan_sample_creator_ids
    from (
      select r.id as run_id,
             r.creator_id
      from public.runs r
      left join public.profiles p on p.id = r.creator_id
      where r.creator_id is not null
        and p.id is null
      order by r.id
      limit 10
    ) orphan_runs;

    if runs_orphan_count > 0 then
      raise exception using
        message = format(
          'Cannot repoint public.runs.creator_id to public.profiles(id): %s row(s) still reference creator_id values with no matching profile after backfilling from auth.users. Manual cleanup is required before rerunning this migration; no rows were deleted. Sample run ids: %s. Sample missing creator_id values: %s',
          runs_orphan_count,
          array_to_string(runs_orphan_sample_ids, ', '),
          array_to_string(runs_orphan_sample_creator_ids, ', ')
        );
    end if;

    select c.conname,
           c.confrelid::regclass,
           c.confdeltype,
           c.confupdtype
      into runs_creator_constraint_name,
           runs_creator_constraint_target,
           runs_creator_confdeltype,
           runs_creator_confupdtype
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = c.conkey[1]
    where c.conrelid = 'public.runs'::regclass
      and c.contype = 'f'
      and array_length(c.conkey, 1) = 1
      and a.attname = 'creator_id'
    limit 1;

    if runs_creator_constraint_target is distinct from 'public.profiles'::regclass then
      if runs_creator_constraint_name is not null then
        execute format(
          'alter table public.runs drop constraint %I',
          runs_creator_constraint_name
        );
      end if;

      execute format(
        'alter table public.runs add constraint runs_creator_id_fkey foreign key (creator_id) references public.profiles (id) %s %s',
        case coalesce(runs_creator_confdeltype, 'a')
          when 'a' then 'on delete no action'
          when 'r' then 'on delete restrict'
          when 'c' then 'on delete cascade'
          when 'n' then 'on delete set null'
          when 'd' then 'on delete set default'
        end,
        case coalesce(runs_creator_confupdtype, 'a')
          when 'a' then 'on update no action'
          when 'r' then 'on update restrict'
          when 'c' then 'on update cascade'
          when 'n' then 'on update set null'
          when 'd' then 'on update set default'
        end
      );
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'run_participants'
  ) then
    insert into public.profiles (id, name)
    select distinct
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
    from public.run_participants rp
    join auth.users au on au.id = rp.user_id
    left join public.profiles p on p.id = au.id
    where rp.user_id is not null
      and p.id is null
    on conflict (id) do nothing;

    select count(*)
      into run_participants_orphan_count
    from public.run_participants rp
    left join public.profiles p on p.id = rp.user_id
    where rp.user_id is not null
      and p.id is null;

    select coalesce(array_agg(sample_key order by sample_key), '{}'::text[]),
           coalesce(array_agg(user_id order by user_id), '{}'::uuid[])
      into run_participants_orphan_sample_keys
         , run_participants_orphan_sample_user_ids
    from (
      select format('%s:%s', rp.run_id, rp.user_id) as sample_key,
             rp.user_id
      from public.run_participants rp
      left join public.profiles p on p.id = rp.user_id
      where rp.user_id is not null
        and p.id is null
      order by rp.run_id, rp.user_id
      limit 10
    ) orphan_participants;

    if run_participants_orphan_count > 0 then
      raise exception using
        message = format(
          'Cannot repoint public.run_participants.user_id to public.profiles(id): %s row(s) still reference user_id values with no matching profile after backfilling from auth.users. Manual cleanup is required before rerunning this migration; no rows were deleted. Sample run_id:user_id pairs: %s. Sample missing user_id values: %s',
          run_participants_orphan_count,
          array_to_string(run_participants_orphan_sample_keys, ', '),
          array_to_string(run_participants_orphan_sample_user_ids, ', ')
        );
    end if;

    select c.conname,
           c.confrelid::regclass,
           c.confdeltype,
           c.confupdtype
      into run_participants_user_constraint_name,
           run_participants_user_constraint_target,
           run_participants_user_confdeltype,
           run_participants_user_confupdtype
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = c.conkey[1]
    where c.conrelid = 'public.run_participants'::regclass
      and c.contype = 'f'
      and array_length(c.conkey, 1) = 1
      and a.attname = 'user_id'
    limit 1;

    if run_participants_user_constraint_target is distinct from 'public.profiles'::regclass then
      if run_participants_user_constraint_name is not null then
        execute format(
          'alter table public.run_participants drop constraint %I',
          run_participants_user_constraint_name
        );
      end if;

      execute format(
        'alter table public.run_participants add constraint run_participants_user_id_fkey foreign key (user_id) references public.profiles (id) %s %s',
        case coalesce(run_participants_user_confdeltype, 'a')
          when 'a' then 'on delete no action'
          when 'r' then 'on delete restrict'
          when 'c' then 'on delete cascade'
          when 'n' then 'on delete set null'
          when 'd' then 'on delete set default'
        end,
        case coalesce(run_participants_user_confupdtype, 'a')
          when 'a' then 'on update no action'
          when 'r' then 'on update restrict'
          when 'c' then 'on update cascade'
          when 'n' then 'on update set null'
          when 'd' then 'on update set default'
        end
      );
    end if;
  end if;
end
$$;
