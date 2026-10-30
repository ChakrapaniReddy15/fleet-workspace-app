import { redirect } from "next/navigation";
import { createReadOnlyClient } from "./server";

export const accessDeniedMessage = "Not found or access denied.";

const roleRank = { viewer: 1, editor: 2, owner: 3 } as const;
export type WorkspaceRole = keyof typeof roleRank;

export async function getAuthenticatedClient() {
  const supabase = await createReadOnlyClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (
    error?.name === "AuthSessionMissingError" ||
    error?.status === 401 ||
    (!error && !user)
  ) {
    return null;
  }
  if (error || !user) throw new Error("Unable to verify the signed-in user.");

  return { supabase, user };
}

export async function requireWorkspaceRole(
  workspaceId: string,
  minimumRole: WorkspaceRole,
) {
  const authenticated = await getAuthenticatedClient();
  if (!authenticated) {
    return null;
  }

  const { data: membership, error } = await authenticated.supabase
    .from("memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", authenticated.user.id)
    .maybeSingle();

  if (
    error ||
    !membership ||
    roleRank[membership.role] < roleRank[minimumRole]
  ) {
    return null;
  }

  return authenticated;
}

export async function requireUser() {
  const authenticated = await getAuthenticatedClient();
  if (!authenticated) {
    redirect("/");
  }
  return authenticated;
}
