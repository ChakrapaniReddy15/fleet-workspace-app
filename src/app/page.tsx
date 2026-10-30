import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { signOut } from "./actions";
import Loading from "./loading";
import { getAuthenticatedClient } from "@/lib/supabase/auth";

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  await connection();
  const authenticated = await getAuthenticatedClient();

  if (!authenticated) {
    redirect("/login");
  }

  const { supabase, user } = authenticated;
  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", user.id);

  if (membershipsError) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="form-feedback error">
            Your workspaces could not be loaded. Refresh and try again.
          </p>
        </section>
      </main>
    );
  }

  if (!memberships?.length) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">FLEET WORKSPACE</p>
          <h1>No workspace access</h1>
          <p className="muted">
            Your account is not a member of a fleet workspace yet.
          </p>
          <form action={signOut}>
            <button className="button secondary" type="submit">Sign out</button>
          </form>
        </section>
      </main>
    );
  }

  const workspaceIds = memberships.map(({ workspace_id }) => workspace_id);
  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("id, name")
    .in("id", workspaceIds)
    .order("name");

  if (workspacesError || !workspaces?.length) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="form-feedback error">
            Your workspaces could not be loaded. Refresh and try again.
          </p>
        </section>
      </main>
    );
  }

  if (workspaces.length === 1) {
    redirect(`/w/${workspaces[0].id}`);
  }

  return (
    <main className="app-shell narrow-shell">
      <header className="topbar">
        <Link aria-label="Fleet workspace home" className="brand" href="/">
          <span className="brand-mark small">F</span> Fleet workspace
        </Link>
        <form action={signOut}>
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </header>
      <section className="workspace-picker">
        <p className="eyebrow">YOUR FLEETS</p>
        <h1>Choose a workspace</h1>
        <p className="muted">
          Signed in as {user.email}. Your workspaces stay isolated from each
          other.
        </p>
        <div className="workspace-choice-list">
          {workspaces.map((workspace) => {
            const membership = memberships.find(
              (item) => item.workspace_id === workspace.id,
            );
            return (
              <Link
                className="workspace-choice"
                href={`/w/${workspace.id}`}
                key={workspace.id}
              >
                <span className="workspace-icon">↗</span>
                <span>
                  <strong>{workspace.name}</strong>
                  <small>{membership?.role ?? "member"}</small>
                </span>
                <span className="choice-arrow">→</span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
