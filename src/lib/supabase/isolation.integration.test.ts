import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { beforeAll, describe, expect, it } from "vitest";

const workspaceA = "20000000-0000-4000-8000-000000000001";
const workspaceB = "20000000-0000-4000-8000-000000000002";
const projectA = "30000000-0000-4000-8000-000000000001";
const projectB = "30000000-0000-4000-8000-000000000003";
const noteB = "40000000-0000-4000-8000-000000000004";
const password = "FleetDemo2026!";

function createTestClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Start local Supabase and configure .env.local before running integration tests.",
    );
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createTestClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    throw new Error(`Could not sign in the local test user ${email}.`);
  }
  return client;
}

describe("workspace isolation against local PostgREST", () => {
  let ownerA: SupabaseClient;
  let ownerB: SupabaseClient;
  let viewerA: SupabaseClient;

  beforeAll(async () => {
    [ownerA, ownerB, viewerA] = await Promise.all([
      signIn("owner@fleet.test"),
      signIn("editor@fleet.test"),
      signIn("viewer@fleet.test"),
    ]);
  }, 20_000);

  it("denies cross-workspace reads, updates, deletes, and forged workspace IDs", async () => {
    const hiddenProject = await ownerA
      .from("projects")
      .select("id")
      .eq("workspace_id", workspaceB)
      .eq("id", projectB);
    expect(hiddenProject.error).toBeNull();
    expect(hiddenProject.data).toEqual([]);

    const changedProject = await ownerA
      .from("projects")
      .update({ name: "Tampered vehicle" })
      .eq("workspace_id", workspaceB)
      .eq("id", projectB)
      .select("id");
    expect(changedProject.error).toBeNull();
    expect(changedProject.data).toEqual([]);

    const removedProject = await ownerA
      .from("projects")
      .delete()
      .eq("workspace_id", workspaceB)
      .eq("id", projectB)
      .select("id");
    expect(removedProject.error).toBeNull();
    expect(removedProject.data).toEqual([]);

    const hiddenNote = await ownerA
      .from("notes")
      .select("id")
      .eq("workspace_id", workspaceB)
      .eq("id", noteB);
    expect(hiddenNote.error).toBeNull();
    expect(hiddenNote.data).toEqual([]);

    const changedNote = await ownerA
      .from("notes")
      .update({ body: "Tampered note" })
      .eq("workspace_id", workspaceB)
      .eq("id", noteB)
      .select("id");
    expect(changedNote.error).toBeNull();
    expect(changedNote.data).toEqual([]);

    const removedNote = await ownerA
      .from("notes")
      .delete()
      .eq("workspace_id", workspaceB)
      .eq("id", noteB)
      .select("id");
    expect(removedNote.error).toBeNull();
    expect(removedNote.data).toEqual([]);

    const forgedBody = await ownerA.from("projects").insert({
      workspace_id: workspaceB,
      name: "Forged vehicle",
      registration: "FAKE 001",
    });
    expect(forgedBody.error).not.toBeNull();

    const forgedNote = await ownerA.from("notes").insert({
      workspace_id: workspaceB,
      project_id: projectA,
      body: "Forged cross-tenant note",
    });
    expect(forgedNote.error).not.toBeNull();

    const stillExists = await ownerB
      .from("projects")
      .select("name")
      .eq("workspace_id", workspaceB)
      .eq("id", projectB)
      .single();
    expect(stillExists.data?.name).toBe("Hyundai Aura");
    expect(stillExists.error).toBeNull();

    const noteStillExists = await ownerB
      .from("notes")
      .select("body")
      .eq("workspace_id", workspaceB)
      .eq("id", noteB)
      .single();
    expect(noteStillExists.data?.body).toContain("Routine service completed");
    expect(noteStillExists.error).toBeNull();
  });

  it("denies write access to viewers and permits a distinct role per workspace", async () => {
    const viewerInsert = await viewerA.from("projects").insert({
      workspace_id: workspaceA,
      name: "Viewer attempt",
      registration: "VIEW 001",
    });
    expect(viewerInsert.error).not.toBeNull();

    const editorInvite = await ownerB.rpc("invite_workspace_member", {
      p_workspace_id: workspaceA,
      p_email: "viewer@fleet.test",
      p_role: "viewer",
    });
    expect(editorInvite.error).not.toBeNull();

    const ownerInvite = await ownerA.rpc("invite_workspace_member", {
      p_workspace_id: workspaceA,
      p_email: "viewer@fleet.test",
      p_role: "viewer",
    });
    expect(ownerInvite.error).toBeNull();
    expect(ownerInvite.data).toBe(true);

    const memberships = await ownerB
      .from("memberships")
      .select("workspace_id, role")
      .eq("user_id", "10000000-0000-4000-8000-000000000002");
    expect(memberships.error).toBeNull();
    expect(memberships.data).toEqual(
      expect.arrayContaining([
        { workspace_id: workspaceA, role: "editor" },
        { workspace_id: workspaceB, role: "owner" },
      ]),
    );
  });

  it("lists workspace members only for owners and only within that workspace", async () => {
    const workspaceAMembers = await ownerA.rpc("list_workspace_members", {
      p_workspace_id: workspaceA,
    });
    expect(workspaceAMembers.error).toBeNull();
    expect(workspaceAMembers.data).toEqual(
      expect.arrayContaining([
        {
          user_id: "10000000-0000-4000-8000-000000000001",
          display_name: "Fleet Owner",
          role: "owner",
        },
        {
          user_id: "10000000-0000-4000-8000-000000000002",
          display_name: "Fleet Editor",
          role: "editor",
        },
      ]),
    );
    expect(workspaceAMembers.data).toHaveLength(3);

    const workspaceBMembers = await ownerB.rpc("list_workspace_members", {
      p_workspace_id: workspaceB,
    });
    expect(workspaceBMembers.error).toBeNull();
    expect(workspaceBMembers.data).toEqual(
      expect.arrayContaining([
        {
          user_id: "10000000-0000-4000-8000-000000000002",
          display_name: "Fleet Editor",
          role: "owner",
        },
        {
          user_id: "10000000-0000-4000-8000-000000000003",
          display_name: "Fleet Viewer",
          role: "editor",
        },
      ]),
    );
    expect(workspaceBMembers.data).toHaveLength(2);

    const viewerMembers = await viewerA.rpc("list_workspace_members", {
      p_workspace_id: workspaceA,
    });
    expect(viewerMembers.error).toBeNull();
    expect(viewerMembers.data).toEqual([]);

    const crossWorkspaceMembers = await ownerA.rpc(
      "list_workspace_members",
      { p_workspace_id: workspaceB },
    );
    expect(crossWorkspaceMembers.error).toBeNull();
    expect(crossWorkspaceMembers.data).toEqual([]);
  });

  it("gives identical direct-database responses for another workspace and a missing one", async () => {
    const missing = "99999999-9999-4999-8999-999999999999";
    const shape = (result: { data: unknown; error: { code: string; message: string } | null }) => ({
      data: result.data,
      code: result.error?.code ?? null,
      message: result.error?.message ?? null,
    });

    for (const table of ["workspaces", "projects", "notes", "project_summaries"] as const) {
      const column = table === "workspaces" ? "id" : "workspace_id";
      const other = await ownerA.from(table).select("*").eq(column, workspaceB);
      const absent = await ownerA.from(table).select("*").eq(column, missing);
      expect(shape(other)).toEqual({ data: [], code: null, message: null });
      expect(shape(absent)).toEqual(shape(other));
    }

    const forgedOther = await ownerA
      .from("projects")
      .insert({ workspace_id: workspaceB, name: "Forged", registration: "FAKE 002" });
    const forgedAbsent = await ownerA
      .from("projects")
      .insert({ workspace_id: missing, name: "Forged", registration: "FAKE 002" });
    expect(forgedOther.error?.code).toBe("42501");
    expect(shape(forgedAbsent)).toEqual(shape(forgedOther));

    const inviteOther = await ownerA.rpc("invite_workspace_member", {
      p_workspace_id: workspaceB,
      p_email: "owner@fleet.test",
      p_role: "editor",
    });
    const inviteAbsent = await ownerA.rpc("invite_workspace_member", {
      p_workspace_id: missing,
      p_email: "owner@fleet.test",
      p_role: "editor",
    });
    expect(inviteOther.error?.code).toBe("42501");
    expect(shape(inviteAbsent)).toEqual(shape(inviteOther));
  });

  it("denies viewer edits, direct membership writes, and anonymous access", async () => {
    const viewerUpdate = await viewerA
      .from("projects")
      .update({ name: "Viewer edit" })
      .eq("id", projectA)
      .select("id");
    expect(viewerUpdate.data ?? []).toEqual([]);

    const viewerDelete = await viewerA
      .from("notes")
      .delete()
      .eq("workspace_id", workspaceA)
      .select("id");
    expect(viewerDelete.data ?? []).toEqual([]);

    // Owners invite through the checked RPC only; a direct insert could grant
    // the owner role.
    const directMembership = await ownerA.from("memberships").insert({
      workspace_id: workspaceA,
      user_id: "10000000-0000-4000-8000-000000000003",
      role: "owner",
    });
    expect(directMembership.error).not.toBeNull();

    // Re-inviting an owner must not demote them.
    const demoteOwner = await ownerA.rpc("invite_workspace_member", {
      p_workspace_id: workspaceA,
      p_email: "owner@fleet.test",
      p_role: "viewer",
    });
    expect(demoteOwner.error).toBeNull();
    const ownerRole = await ownerA
      .from("memberships")
      .select("role")
      .eq("workspace_id", workspaceA)
      .eq("user_id", "10000000-0000-4000-8000-000000000001")
      .single();
    expect(ownerRole.data?.role).toBe("owner");

    const anonymous = createTestClient();
    for (const table of ["workspaces", "projects", "notes", "memberships"] as const) {
      const result = await anonymous.from(table).select("*");
      expect(result.data ?? []).toEqual([]);
    }

    const stillThere = await ownerA.from("projects").select("name").eq("id", projectA).single();
    expect(stillThere.data?.name).toBe("Tata Ace");
  });

  it("enables and forces row-level security on every tenant table", async () => {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      throw new Error(
        "Run npm run db:env after starting Supabase to configure the catalog test.",
      );
    }

    const client = new Client({ connectionString });
    await client.connect();
    try {
      const { rows } = await client.query<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relkind = 'r'
           and c.relname = any($1::text[])`,
        [[
          "profiles",
          "workspaces",
          "memberships",
          "projects",
          "notes",
          "project_summaries",
        ]],
      );

      expect(rows).toHaveLength(6);
      expect(rows.every((row) => row.relrowsecurity)).toBe(true);
      expect(rows.every((row) => row.relforcerowsecurity)).toBe(true);

      const { rows: policies } = await client.query<{
        tablename: string;
        count: string;
      }>(
        `select tablename, count(*) filter (where permissive = 'RESTRICTIVE') as count
         from pg_policies
         where schemaname = 'public'
           and tablename = any($1::text[])
         group by tablename`,
        [[
          "profiles",
          "workspaces",
          "memberships",
          "projects",
          "notes",
          "project_summaries",
        ]],
      );
      const restrictivePolicyCounts = Object.fromEntries(
        policies.map(({ tablename, count }) => [tablename, Number(count)]),
      );
      expect(restrictivePolicyCounts).toEqual({
        profiles: 2,
        workspaces: 1,
        memberships: 3,
        projects: 4,
        notes: 4,
        project_summaries: 4,
      });
    } finally {
      await client.end();
    }
  });
});
