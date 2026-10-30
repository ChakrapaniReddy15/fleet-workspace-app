-- Invitations go through invite_workspace_member only. A direct INSERT would
-- let an owner grant the owner role or bypass the invite rules, so the table
-- privilege is removed; the existing policies stay as a second layer.
revoke insert on public.memberships from authenticated;

-- Re-inviting an existing owner must not demote them (which could leave a
-- workspace with no owner). Owners keep their role; other members are updated.
create or replace function public.invite_workspace_member(
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
  do update set role = excluded.role
  where public.memberships.role <> 'owner'::public.membership_role;

  return true;
end;
$$;

revoke all on function public.invite_workspace_member(
  uuid, text, public.membership_role
) from public, anon;
grant execute on function public.invite_workspace_member(
  uuid, text, public.membership_role
) to authenticated;

