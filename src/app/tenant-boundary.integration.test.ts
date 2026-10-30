import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Server actions and the proxy read the session from Next's request cookies.
// An in-memory jar stands in for them so the real code paths run unchanged.
const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) } : undefined,
    set: (name: string, value: string) => {
      if (value) jar.set(name, value);
      else jar.delete(name);
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

const { createClient } = await import("@/lib/supabase/server");
const actions = await import("./actions");
const { proxy } = await import("@/proxy");

const workspaceA = "20000000-0000-4000-8000-000000000001";
const workspaceB = "20000000-0000-4000-8000-000000000002";
const projectA = "30000000-0000-4000-8000-000000000001";
const projectB = "30000000-0000-4000-8000-000000000003";
const noteB = "40000000-0000-4000-8000-000000000004";
const missing = "99999999-9999-4999-8999-999999999999";
const password = "FleetDemo2026!";
const denied = { message: "Not found or access denied.", success: false };

async function signInAs(email: string) {
  jar.clear();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in the local test user ${email}.`);
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function visit(path: string) {
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  const response = await proxy(
    new NextRequest(new URL(path, "http://localhost:3000"), {
      headers: { cookie },
    }),
  );
  return response.headers.get("x-middleware-rewrite");
}

async function ownerBSees() {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  await client.auth.signInWithPassword({ email: "editor@fleet.test", password });
  const [project, note] = await Promise.all([
    client.from("projects").select("name").eq("id", projectB).single(),
    client.from("notes").select("body").eq("id", noteB).single(),
  ]);
  return { project: project.data?.name, note: note.data?.body };
}

describe("edge case 1: forged IDs as a Deccan-only owner", () => {
  beforeEach(async () => {
    await signInAs("owner@fleet.test");
  }, 20_000);

  it("URL: another workspace or vehicle looks exactly like a missing one", async () => {
    const unavailable = "http://localhost:3000/resource-unavailable";

    expect(await visit(`/w/${workspaceA}`)).toBeNull();
    expect(await visit(`/w/${workspaceA}/p/${projectA}`)).toBeNull();

    expect(await visit(`/w/${workspaceB}`)).toBe(unavailable);
    expect(await visit(`/w/${missing}`)).toBe(unavailable);
    expect(await visit(`/w/${workspaceB}/p/${projectB}`)).toBe(unavailable);
    expect(await visit(`/w/${workspaceA}/p/${projectB}`)).toBe(unavailable);
    expect(await visit(`/w/${workspaceA}/p/${missing}`)).toBe(unavailable);
  });

  it("request body: every mutation returns the same denial for real and missing IDs", async () => {
    const before = await ownerBSees();
    const vehicle = { name: "Tampered", registration: "FAKE 001", status: "active" };
    const attempts = [
      // Workspace ID in the body points at another tenant or nowhere.
      ...[workspaceB, missing].map((workspaceId) =>
        actions.createProject(denied, form({ workspaceId, ...vehicle })),
      ),
      // Own workspace ID with another tenant's (or a missing) project ID.
      ...[projectB, missing].flatMap((projectId) => [
        actions.updateProject(denied, form({ workspaceId: workspaceA, projectId, ...vehicle })),
        actions.deleteProject(denied, form({ workspaceId: workspaceA, projectId })),
        actions.createNote(denied, form({ workspaceId: workspaceA, projectId, body: "Forged" })),
        actions.summarizeProject(denied, form({ workspaceId: workspaceA, projectId })),
      ]),
      // Another tenant's (or a missing) note ID.
      ...[noteB, missing].flatMap((id) => [
        actions.updateNote(denied, form({ workspaceId: workspaceA, projectId: projectA, id, body: "Forged" })),
        actions.deleteNote(denied, form({ workspaceId: workspaceA, projectId: projectA, id })),
      ]),
      // Full set of the other tenant's IDs.
      actions.updateNote(denied, form({ workspaceId: workspaceB, projectId: projectB, id: noteB, body: "Forged" })),
      actions.inviteMember(denied, form({ workspaceId: workspaceB, email: "owner@fleet.test", role: "editor" })),
      actions.inviteMember(denied, form({ workspaceId: missing, email: "owner@fleet.test", role: "editor" })),
    ];

    for (const result of await Promise.all(attempts)) {
      expect(result).toEqual(denied);
    }
    expect(await ownerBSees()).toEqual(before);
  });
});

describe("server-side role checks", () => {
  it("rejects viewer writes and editor invites even with valid IDs", async () => {
    await signInAs("viewer@fleet.test");
    expect(
      await actions.createProject(
        denied,
        form({ workspaceId: workspaceA, name: "Viewer", registration: "VIEW 1", status: "active" }),
      ),
    ).toEqual(denied);
    expect(
      await actions.createNote(
        denied,
        form({ workspaceId: workspaceA, projectId: projectA, body: "Viewer note" }),
      ),
    ).toEqual(denied);

    await signInAs("editor@fleet.test");
    expect(
      await actions.inviteMember(
        denied,
        form({ workspaceId: workspaceA, email: "viewer@fleet.test", role: "editor" }),
      ),
    ).toEqual(denied);
  }, 20_000);
});
