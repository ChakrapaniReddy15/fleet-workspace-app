import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { signOut } from "@/app/actions";
import Loading from "@/app/loading";
import {
  InviteForm,
  ProjectCreateForm,
  ProjectDeleteForm,
  ProjectEditForm,
} from "@/app/ui/forms";
import { getAuthenticatedClient } from "@/lib/supabase/auth";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <WorkspaceContent params={params} />
    </Suspense>
  );
}

async function WorkspaceContent({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  await connection();
  const { workspaceId } = await params;
  const authenticated = await getAuthenticatedClient();
  if (!authenticated) notFound();

  const { supabase, user } = authenticated;
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) notFound();

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceError || !workspace) notFound();

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, registration, status")
    .eq("workspace_id", workspaceId)
    .order("name");

  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", user.id);

  let switcherWorkspaces: { id: string; name: string }[] = [];
  let switcherError = Boolean(membershipsError);
  if (!membershipsError && memberships?.length) {
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name")
      .in(
        "id",
        memberships.map(({ workspace_id }) => workspace_id),
      )
      .order("name");
    switcherWorkspaces = data ?? [];
    switcherError = Boolean(error);
  }

  const role = membership.role;
  const canEdit = role === "owner" || role === "editor";
  const { data: workspaceMembers, error: workspaceMembersError } =
    role === "owner"
      ? await supabase.rpc("list_workspace_members", {
          p_workspace_id: workspace.id,
        })
      : { data: null, error: null };
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link aria-label="Fleet workspace home" className="brand" href="/">
          <span className="brand-mark small">F</span> Fleet workspace
        </Link>
        <nav className="workspace-nav" aria-label="Workspace navigation">
          <span className="workspace-select-label">Switch fleet</span>
          {switcherError ? (
            <span className="form-feedback error" role="alert">
              Workspace switcher unavailable.
            </span>
          ) : (
            <div className="workspace-links">
              {switcherWorkspaces.map((item) => (
                <Link
                  aria-current={item.id === workspace.id ? "page" : undefined}
                  href={`/w/${item.id}`}
                  key={item.id}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          )}
        </nav>
        <div className="user-actions">
          <span className="user-role">{role}</span>
          <span className="user-email">{user.email}</span>
          <form action={signOut}>
            <button className="text-button" type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow">FLEET OVERVIEW</p>
          <h1>{workspace.name}</h1>
          <p className="muted">
            {projects?.length ?? 0} vehicle{projects?.length === 1 ? "" : "s"} ·
            {" "}You have {role} access
          </p>
        </div>
        <div className="heading-stamp">Workspace secured with row-level security</div>
      </section>

      <section className="content-grid">
        <div className="main-column">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR VEHICLES</p>
              <h2>Fleet vehicles</h2>
            </div>
          </div>
          {projectsError ? (
            <div className="empty-state error-state">
              <h3>Vehicles could not be loaded</h3>
              <p>Refresh the page and try again.</p>
            </div>
          ) : !projects?.length ? (
            <div className="empty-state">
              <div className="empty-icon">＋</div>
              <h3>No vehicles yet</h3>
              <p>Add the first vehicle to start keeping its service notes.</p>
            </div>
          ) : (
            <div className="vehicle-list">
              {projects.map((project) => (
                <article className="vehicle-card" key={project.id}>
                  <div className="vehicle-top">
                    <span className={`status-dot ${project.status}`} />
                    <span className={`status-label ${project.status}`}>
                      {project.status}
                    </span>
                  </div>
                  <h3>{project.name}</h3>
                  <p className="registration">{project.registration}</p>
                  <Link
                    className="vehicle-link"
                    href={`/w/${workspace.id}/p/${project.id}`}
                  >
                    View notes <span aria-hidden="true">→</span>
                  </Link>
                  {canEdit && (
                    <details className="edit-details">
                      <summary>Edit vehicle</summary>
                      <ProjectEditForm
                        name={project.name}
                        projectId={project.id}
                        registration={project.registration}
                        status={project.status}
                        workspaceId={workspace.id}
                      />
                      <ProjectDeleteForm
                        projectId={project.id}
                        workspaceId={workspace.id}
                      />
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="side-column">
          {canEdit && (
            <section className="panel">
              <p className="eyebrow">ADD TO FLEET</p>
              <h2>New vehicle</h2>
              <ProjectCreateForm workspaceId={workspace.id} />
            </section>
          )}
          {role === "owner" && (
            <section className="panel">
              <p className="eyebrow">TEAM ACCESS</p>
              <div className="member-heading">
                <h2>Members</h2>
                {!workspaceMembersError && workspaceMembers && (
                  <span className="member-count">
                    {workspaceMembers.length}
                  </span>
                )}
              </div>
              <p className="muted">
                People with access to {workspace.name}
              </p>
              {workspaceMembersError ? (
                <p className="form-feedback error" role="alert">
                  Workspace members could not be loaded.
                </p>
              ) : workspaceMembers?.length ? (
                <ul className="member-list">
                  {workspaceMembers.map((member) => {
                    const displayName =
                      member.display_name.trim() || "Workspace member";
                    const initials = displayName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase();
                    return (
                      <li className="member-row" key={member.user_id}>
                        <span className="member-avatar" aria-hidden="true">
                          {initials}
                        </span>
                        <span className="member-identity">
                          <strong>{displayName}</strong>
                          {member.user_id === user.id && (
                            <small className="member-self">You</small>
                          )}
                        </span>
                        <span className={`user-role member-role ${member.role}`}>
                          {member.role}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="member-empty">No members found for this workspace.</p>
              )}
              <div className="invite-divider" />
              <h3 className="invite-heading">Invite a member</h3>
              <p className="muted">
                Add an existing demo account to this fleet as an editor or
                viewer.
              </p>
              <InviteForm workspaceId={workspace.id} />
            </section>
          )}
          <section className="security-note">
            <span className="security-icon">⌑</span>
            <div>
              <strong>Private by design</strong>
              <p>Database policies scope every vehicle and note to this fleet.</p>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
