import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { signOut } from "@/app/actions";
import Loading from "@/app/loading";
import {
  NoteCreateForm,
  NoteDeleteForm,
  NoteEditForm,
  SummaryForm,
} from "@/app/ui/forms";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { projectSummarySchema } from "@/lib/summarization/schema";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <ProjectContent params={params} />
    </Suspense>
  );
}

async function ProjectContent({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  await connection();
  const { workspaceId, projectId } = await params;
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

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, registration, status")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (projectError || !project) notFound();

  const { data: notes, error: notesError } = await supabase
    .from("notes")
    .select("id, body, created_at")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: storedSummary, error: summaryError } = await supabase
    .from("project_summaries")
    .select("summary, key_points, generated_at")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .maybeSingle();

  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", user.id);
  const workspaceIds = memberships?.map(({ workspace_id }) => workspace_id) ?? [];
  const { data: workspaces, error: workspacesError } = workspaceIds.length
    ? await supabase
        .from("workspaces")
        .select("id, name")
        .in("id", workspaceIds)
    : { data: [], error: null };
  const switcherError = Boolean(membershipsError || workspacesError);
  const role = membership.role;
  const canEdit = role === "owner" || role === "editor";
  const parsedSummary = projectSummarySchema.safeParse(
    storedSummary
      ? {
          summary: storedSummary.summary,
          keyPoints: storedSummary.key_points,
        }
      : null,
  );
  const summary = parsedSummary.success ? parsedSummary.data : null;

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
              {workspaces?.map((item) => (
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

      <div className="breadcrumbs">
        <Link href={`/w/${workspace.id}`}>{workspace.name}</Link>
        <span aria-hidden="true">/</span>
        <span>{project.name}</span>
      </div>

      <section className="vehicle-detail-heading">
        <div>
          <p className="eyebrow">VEHICLE NOTES</p>
          <div className="detail-title">
            <h1>{project.name}</h1>
            <span className={`status-label ${project.status}`}>{project.status}</span>
          </div>
          <p className="registration">{project.registration}</p>
        </div>
        <Link className="button secondary" href={`/w/${workspace.id}`}>
          Back to fleet
        </Link>
      </section>

      <section className="content-grid detail-grid">
        <div className="main-column">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ACTIVITY LOG</p>
              <h2>Notes</h2>
            </div>
            <span className="count-pill">{notes?.length ?? 0} notes</span>
          </div>
          {notesError ? (
            <div className="empty-state error-state">
              <h3>Notes could not be loaded</h3>
              <p>Refresh the page and try again.</p>
            </div>
          ) : !notes?.length ? (
            <div className="empty-state">
              <h3>No notes yet</h3>
              <p>Keep service, condition, and inspection updates here.</p>
            </div>
          ) : (
            <div className="note-list">
              {notes.map((note) => (
                <article className="note-card" key={note.id}>
                  <div className="note-meta">
                    <span className="note-bullet" />
                    <time dateTime={note.created_at}>
                      {new Date(note.created_at).toLocaleString("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <p className="note-body">{note.body}</p>
                  {canEdit && (
                    <div className="note-controls">
                      <NoteEditForm
                        body={note.body}
                        id={note.id}
                        projectId={project.id}
                        workspaceId={workspace.id}
                      />
                      <NoteDeleteForm
                        id={note.id}
                        projectId={project.id}
                        workspaceId={workspace.id}
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="side-column">
          {canEdit && (
            <section className="panel">
              <p className="eyebrow">NEW ACTIVITY</p>
              <h2>Add a note</h2>
              <NoteCreateForm
                projectId={project.id}
                workspaceId={workspace.id}
              />
            </section>
          )}
          {canEdit && (
            <section className="panel summary-panel">
              <p className="eyebrow">AI-ASSISTED</p>
              <h2>Vehicle summary</h2>
              <SummaryForm
                projectId={project.id}
                workspaceId={workspace.id}
              />
              {summaryError || (storedSummary && !parsedSummary.success) ? (
                <p className="form-feedback error">
                  The saved summary could not be loaded.
                </p>
              ) : summary ? (
                <div className="summary-result">
                  <p>{summary.summary}</p>
                  {summary.keyPoints.length > 0 && (
                    <ul>
                      {summary.keyPoints.map((point, index) => (
                        <li key={`${index}-${point}`}>{point}</li>
                      ))}
                    </ul>
                  )}
                  {storedSummary && (
                    <small className="muted">
                      Generated{" "}
                      {new Date(storedSummary.generated_at).toLocaleString()}
                    </small>
                  )}
                </div>
              ) : null}
            </section>
          )}
          {!canEdit && summary && (
            <section className="panel summary-panel">
              <p className="eyebrow">VEHICLE SUMMARY</p>
              <h2>Latest summary</h2>
              <div className="summary-result">
                <p>{summary.summary}</p>
                <ul>
                  {summary.keyPoints.map((point, index) => (
                    <li key={`${index}-${point}`}>{point}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}
          <section className="security-note">
            <span className="security-icon">⌑</span>
            <div>
              <strong>Notes are treated as data</strong>
              <p>Summary output is validated before it can be saved.</p>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
