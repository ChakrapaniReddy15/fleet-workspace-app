create type public.membership_role as enum ('owner', 'editor', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default ''
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  registration text not null check (length(trim(registration)) between 1 and 32),
  status text not null default 'active'
    check (status in ('active', 'maintenance', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete cascade
);

create table public.project_summaries (
  project_id uuid not null,
  workspace_id uuid not null,
  summary text not null check (length(trim(summary)) between 1 and 1000),
  key_points jsonb not null
    check (jsonb_typeof(key_points) = 'array' and jsonb_array_length(key_points) <= 5),
  provider text not null default 'mock',
  generated_at timestamptz not null default now(),
  primary key (project_id, workspace_id),
  foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete cascade
);

create index memberships_user_id_idx on public.memberships (user_id);
create index projects_workspace_id_idx on public.projects (workspace_id);
create index notes_project_workspace_idx on public.notes (project_id, workspace_id);

create function public.has_workspace_role(
  p_workspace_id uuid,
  p_minimum_role public.membership_role
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and case m.role
        when 'owner' then 3
        when 'editor' then 2
        when 'viewer' then 1
      end >= case p_minimum_role
        when 'owner' then 3
        when 'editor' then 2
        when 'viewer' then 1
      end
  );
$$;

revoke all on function public.has_workspace_role(uuid, public.membership_role)
  from public, anon;
grant execute on function public.has_workspace_role(uuid, public.membership_role)
  to authenticated;

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

revoke all on function public.create_profile_for_new_user()
  from public, anon, authenticated;

create function public.invite_workspace_member(
  p_workspace_id uuid,
  p_email text,
  p_role public.membership_role
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invited_user_id uuid;
begin
  if auth.uid() is null
    or not public.has_workspace_role(p_workspace_id, 'owner'::public.membership_role)
    or p_role not in ('editor'::public.membership_role, 'viewer'::public.membership_role)
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select u.id into invited_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if invited_user_id is null then
    return false;
  end if;

  insert into public.memberships (workspace_id, user_id, role)
  values (p_workspace_id, invited_user_id, p_role)
  on conflict (workspace_id, user_id)
  do update set role = excluded.role;

  return true;
end;
$$;

revoke all on function public.invite_workspace_member(
  uuid, text, public.membership_role
) from public, anon;
grant execute on function public.invite_workspace_member(
  uuid, text, public.membership_role
) to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.notes enable row level security;
alter table public.notes force row level security;
alter table public.project_summaries enable row level security;
alter table public.project_summaries force row level security;

create policy "profiles_select_self" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "workspaces_select_member" on public.workspaces
  for select to authenticated
  using (public.has_workspace_role(id, 'viewer'::public.membership_role));

create policy "memberships_select_workspace_member" on public.memberships
  for select to authenticated
  using (public.has_workspace_role(workspace_id, 'viewer'::public.membership_role));
create policy "memberships_insert_workspace_owner" on public.memberships
  for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'owner'::public.membership_role));
create policy "memberships_delete_workspace_owner" on public.memberships
  for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'owner'::public.membership_role));

create policy "projects_select_workspace_member" on public.projects
  for select to authenticated
  using (public.has_workspace_role(workspace_id, 'viewer'::public.membership_role));
create policy "projects_insert_workspace_editor" on public.projects
  for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "projects_update_workspace_editor" on public.projects
  for update to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role))
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "projects_delete_workspace_editor" on public.projects
  for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));

create policy "notes_select_workspace_member" on public.notes
  for select to authenticated
  using (public.has_workspace_role(workspace_id, 'viewer'::public.membership_role));
create policy "notes_insert_workspace_editor" on public.notes
  for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "notes_update_workspace_editor" on public.notes
  for update to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role))
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "notes_delete_workspace_editor" on public.notes
  for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));

create policy "summaries_select_workspace_member" on public.project_summaries
  for select to authenticated
  using (public.has_workspace_role(workspace_id, 'viewer'::public.membership_role));
create policy "summaries_insert_workspace_editor" on public.project_summaries
  for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "summaries_update_workspace_editor" on public.project_summaries
  for update to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role))
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "summaries_delete_workspace_editor" on public.project_summaries
  for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));

create policy "profiles_scope_select" on public.profiles
  as restrictive for select to authenticated using (id = auth.uid());
create policy "profiles_scope_update" on public.profiles
  as restrictive for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "workspaces_scope_select" on public.workspaces
  as restrictive for select to authenticated
  using (public.has_workspace_role(id, 'viewer'::public.membership_role));

create policy "memberships_scope_select" on public.memberships
  as restrictive for select to authenticated
  using (public.has_workspace_role(workspace_id, 'viewer'::public.membership_role));
create policy "memberships_scope_insert" on public.memberships
  as restrictive for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'owner'::public.membership_role));
create policy "memberships_scope_delete" on public.memberships
  as restrictive for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'owner'::public.membership_role));

create policy "projects_scope_select" on public.projects
  as restrictive for select to authenticated
  using (public.has_workspace_role(workspace_id, 'viewer'::public.membership_role));
create policy "projects_scope_insert" on public.projects
  as restrictive for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "projects_scope_update" on public.projects
  as restrictive for update to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role))
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "projects_scope_delete" on public.projects
  as restrictive for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));

create policy "notes_scope_select" on public.notes
  as restrictive for select to authenticated
  using (public.has_workspace_role(workspace_id, 'viewer'::public.membership_role));
create policy "notes_scope_insert" on public.notes
  as restrictive for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "notes_scope_update" on public.notes
  as restrictive for update to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role))
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "notes_scope_delete" on public.notes
  as restrictive for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));

create policy "summaries_scope_select" on public.project_summaries
  as restrictive for select to authenticated
  using (public.has_workspace_role(workspace_id, 'viewer'::public.membership_role));
create policy "summaries_scope_insert" on public.project_summaries
  as restrictive for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "summaries_scope_update" on public.project_summaries
  as restrictive for update to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role))
  with check (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));
create policy "summaries_scope_delete" on public.project_summaries
  as restrictive for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'editor'::public.membership_role));

revoke all on public.profiles, public.workspaces, public.memberships,
  public.projects, public.notes, public.project_summaries from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.workspaces to authenticated;
grant select, insert, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.projects, public.notes,
  public.project_summaries to authenticated;
grant usage on type public.membership_role to authenticated;
