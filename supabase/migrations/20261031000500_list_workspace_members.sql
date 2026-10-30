create function public.list_workspace_members(p_workspace_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role public.membership_role
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id, p.display_name, m.role
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.workspace_id = p_workspace_id
    and public.has_workspace_role(
      p_workspace_id,
      'owner'::public.membership_role
    )
  order by p.display_name, m.user_id;
$$;

revoke all on function public.list_workspace_members(uuid)
  from public, anon;
grant execute on function public.list_workspace_members(uuid)
  to authenticated;
