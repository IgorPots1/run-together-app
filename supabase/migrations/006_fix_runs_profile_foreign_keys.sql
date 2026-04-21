do $$
declare
  runs_creator_constraint_name text;
  runs_creator_constraint_target regclass;
  runs_creator_confdeltype "char";
  runs_creator_confupdtype "char";
  runs_orphan_count bigint;
  runs_orphan_sample_ids uuid[];

  run_participants_user_constraint_name text;
  run_participants_user_constraint_target regclass;
  run_participants_user_confdeltype "char";
  run_participants_user_confupdtype "char";
  run_participants_orphan_count bigint;
  run_participants_orphan_sample_keys text[];
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'runs'
  ) then
    select count(*)
      into runs_orphan_count
    from public.runs r
    left join public.profiles p on p.id = r.creator_id
    where r.creator_id is not null
      and p.id is null;

    select coalesce(array_agg(run_id order by run_id), '{}'::uuid[])
      into runs_orphan_sample_ids
    from (
      select r.id as run_id
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
          'Cannot repoint public.runs.creator_id to public.profiles(id): %s row(s) reference creator_id values with no matching profile. Sample run ids: %s',
          runs_orphan_count,
          array_to_string(runs_orphan_sample_ids, ', ')
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
    select count(*)
      into run_participants_orphan_count
    from public.run_participants rp
    left join public.profiles p on p.id = rp.user_id
    where rp.user_id is not null
      and p.id is null;

    select coalesce(array_agg(sample_key order by sample_key), '{}'::text[])
      into run_participants_orphan_sample_keys
    from (
      select format('%s:%s', rp.run_id, rp.user_id) as sample_key
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
          'Cannot repoint public.run_participants.user_id to public.profiles(id): %s row(s) reference user_id values with no matching profile. Sample run_id:user_id pairs: %s',
          run_participants_orphan_count,
          array_to_string(run_participants_orphan_sample_keys, ', ')
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
