"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MockSummaryProvider } from "@/lib/summarization/mock-provider";
import {
  createValidatedSummary,
  InvalidSummaryError,
} from "@/lib/summarization/validated-summary";
import {
  accessDeniedMessage,
  requireWorkspaceRole,
} from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./action-state";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const projectSchema = z.object({
  workspaceId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  registration: z.string().trim().min(1).max(32),
  status: z.enum(["active", "maintenance", "inactive"]),
});

const noteSchema = z.object({
  workspaceId: z.uuid(),
  projectId: z.uuid(),
  body: z.string().trim().min(1).max(4000),
});

const projectIdentitySchema = z.object({
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

const noteIdentitySchema = z.object({
  workspaceId: z.uuid(),
  projectId: z.uuid(),
  id: z.uuid(),
});

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formActionData(formData: FormData) {
  return {
    workspaceId: readText(formData, "workspaceId"),
    projectId: readText(formData, "projectId"),
    id: readText(formData, "id"),
    name: readText(formData, "name"),
    registration: readText(formData, "registration"),
    status: readText(formData, "status"),
    body: readText(formData, "body"),
  };
}

function denied(): FormState {
  return { message: accessDeniedMessage, success: false };
}

export async function signIn(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: readText(formData, "email").trim(),
    password: readText(formData, "password"),
  });
  if (!parsed.success) {
    return { message: "Enter a valid email and password.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { message: "Unable to sign in with those credentials.", success: false };
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error("Unable to sign out. Please try again.");
  }
  redirect("/login");
}

export async function createProject(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = projectSchema.safeParse(formActionData(formData));
  if (!parsed.success) {
    return { message: "Check the vehicle details and try again.", success: false };
  }
  const access = await requireWorkspaceRole(parsed.data.workspaceId, "editor");
  if (!access) return denied();

  const { error } = await access.supabase.from("projects").insert({
    workspace_id: parsed.data.workspaceId,
    name: parsed.data.name,
    registration: parsed.data.registration,
    status: parsed.data.status,
  });
  if (error) return denied();

  revalidatePath(`/w/${parsed.data.workspaceId}`);
  return { message: "Vehicle added.", success: true };
}

export async function updateProject(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = formActionData(formData);
  const identifiers = projectIdentitySchema.safeParse(input);
  const parsed = projectSchema.safeParse(input);
  if (!identifiers.success || !parsed.success) {
    return { message: "Check the vehicle details and try again.", success: false };
  }
  const access = await requireWorkspaceRole(parsed.data.workspaceId, "editor");
  if (!access) return denied();

  const { data, error } = await access.supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      registration: parsed.data.registration,
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", identifiers.data.projectId)
    .eq("workspace_id", parsed.data.workspaceId)
    .select("id")
    .maybeSingle();
  if (error || !data) return denied();

  revalidatePath(`/w/${parsed.data.workspaceId}`);
  return { message: "Vehicle updated.", success: true };
}

export async function deleteProject(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const identifiers = projectIdentitySchema.safeParse(formActionData(formData));
  if (!identifiers.success) return denied();
  const access = await requireWorkspaceRole(identifiers.data.workspaceId, "editor");
  if (!access) return denied();

  const { data, error } = await access.supabase
    .from("projects")
    .delete()
    .eq("id", identifiers.data.projectId)
    .eq("workspace_id", identifiers.data.workspaceId)
    .select("id")
    .maybeSingle();
  if (error || !data) return denied();

  revalidatePath(`/w/${identifiers.data.workspaceId}`);
  return { message: "Vehicle and its notes deleted.", success: true };
}

export async function createNote(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = noteSchema.safeParse(formActionData(formData));
  if (!parsed.success) {
    return { message: "Enter a note of up to 4,000 characters.", success: false };
  }
  const access = await requireWorkspaceRole(parsed.data.workspaceId, "editor");
  if (!access) return denied();

  const { error } = await access.supabase.from("notes").insert({
    workspace_id: parsed.data.workspaceId,
    project_id: parsed.data.projectId,
    body: parsed.data.body,
  });
  if (error) return denied();

  revalidatePath(`/w/${parsed.data.workspaceId}/p/${parsed.data.projectId}`);
  return { message: "Note added.", success: true };
}

export async function updateNote(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = formActionData(formData);
  const identifiers = noteIdentitySchema.safeParse(input);
  const parsed = noteSchema.safeParse(input);
  if (!identifiers.success || !parsed.success) {
    return { message: "Check the note and try again.", success: false };
  }
  const access = await requireWorkspaceRole(parsed.data.workspaceId, "editor");
  if (!access) return denied();

  const { data, error } = await access.supabase
    .from("notes")
    .update({ body: parsed.data.body, updated_at: new Date().toISOString() })
    .eq("id", identifiers.data.id)
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("project_id", parsed.data.projectId)
    .select("id")
    .maybeSingle();
  if (error || !data) return denied();

  revalidatePath(`/w/${parsed.data.workspaceId}/p/${parsed.data.projectId}`);
  return { message: "Note updated.", success: true };
}

export async function deleteNote(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const identifiers = noteIdentitySchema.safeParse(formActionData(formData));
  if (!identifiers.success) return denied();
  const access = await requireWorkspaceRole(identifiers.data.workspaceId, "editor");
  if (!access) return denied();

  const { data, error } = await access.supabase
    .from("notes")
    .delete()
    .eq("id", identifiers.data.id)
    .eq("workspace_id", identifiers.data.workspaceId)
    .eq("project_id", identifiers.data.projectId)
    .select("id")
    .maybeSingle();
  if (error || !data) return denied();

  revalidatePath(`/w/${identifiers.data.workspaceId}/p/${identifiers.data.projectId}`);
  return { message: "Note deleted.", success: true };
}

const inviteSchema = z.object({
  workspaceId: z.uuid(),
  email: z.email(),
  role: z.enum(["editor", "viewer"]),
});

export async function inviteMember(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = inviteSchema.safeParse({
    workspaceId: readText(formData, "workspaceId"),
    email: readText(formData, "email").trim(),
    role: readText(formData, "role"),
  });
  if (!parsed.success) {
    return { message: "Enter a valid email and role.", success: false };
  }
  const access = await requireWorkspaceRole(parsed.data.workspaceId, "owner");
  if (!access) return denied();

  const { error } = await access.supabase.rpc("invite_workspace_member", {
    p_workspace_id: parsed.data.workspaceId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return denied();

  revalidatePath(`/w/${parsed.data.workspaceId}`);
  return {
    message: "If the account exists, it now has workspace access.",
    success: true,
  };
}

const summaryProvider = new MockSummaryProvider();

export async function summarizeProject(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const identifiers = z
    .object({ workspaceId: z.uuid(), projectId: z.uuid() })
    .safeParse({
      workspaceId: readText(formData, "workspaceId"),
      projectId: readText(formData, "projectId"),
    });
  if (!identifiers.success) return denied();
  const { workspaceId, projectId } = identifiers.data;
  const access = await requireWorkspaceRole(workspaceId, "editor");
  if (!access) return denied();

  const { data: project, error: projectError } = await access.supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (projectError || !project) return denied();

  const { data: notes, error: notesError } = await access.supabase
    .from("notes")
    .select("body")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(50);
  if (notesError || !notes) return denied();

  try {
    const summary = await createValidatedSummary(
      summaryProvider,
      notes.map(({ body }) => body.slice(0, 4000)),
    );
    const { error } = await access.supabase.from("project_summaries").upsert(
      {
        workspace_id: workspaceId,
        project_id: projectId,
        summary: summary.summary,
        key_points: summary.keyPoints,
        provider: "mock",
        generated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,workspace_id" },
    );
    if (error) return denied();
  } catch (error) {
    if (error instanceof InvalidSummaryError) {
      return {
        message: "Summary output was invalid. No summary was saved; try again.",
        success: false,
      };
    }
    return {
      message: "Summary could not be generated. No summary was saved.",
      success: false,
    };
  }

  revalidatePath(`/w/${workspaceId}/p/${projectId}`);
  return { message: "Summary generated and validated.", success: true };
}
