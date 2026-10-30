"use client";

import { useActionState } from "react";
import {
  createNote,
  createProject,
  deleteNote,
  deleteProject,
  inviteMember,
  signIn,
  summarizeProject,
  updateNote,
  updateProject,
} from "../actions";
import { initialFormState, type FormState } from "../action-state";

function Feedback({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      className={state.success ? "form-feedback success" : "form-feedback error"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialFormState);
  return (
    <form action={action} className="form-stack">
      <label>
        Email
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        Password
        <input
          autoComplete="current-password"
          name="password"
          required
          type="password"
        />
      </label>
      <Feedback state={state} />
      <button className="button primary" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function ProjectCreateForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(createProject, initialFormState);
  return (
    <form action={action} className="form-stack">
      <input name="workspaceId" type="hidden" value={workspaceId} />
      <label>
        Vehicle name
        <input maxLength={120} name="name" placeholder="Tata Ace" required />
      </label>
      <label>
        Registration
        <input
          maxLength={32}
          name="registration"
          placeholder="TS09 UB 4521"
          required
        />
      </label>
      <label>
        Status
        <select defaultValue="active" name="status">
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <Feedback state={state} />
      <button className="button primary" disabled={pending} type="submit">
        {pending ? "Adding…" : "Add vehicle"}
      </button>
    </form>
  );
}

type VehicleFormProps = {
  workspaceId: string;
  projectId: string;
  name: string;
  registration: string;
  status: "active" | "maintenance" | "inactive";
};

export function ProjectEditForm(props: VehicleFormProps) {
  const [state, action, pending] = useActionState(updateProject, initialFormState);
  return (
    <form action={action} className="vehicle-edit-form">
      <input name="workspaceId" type="hidden" value={props.workspaceId} />
      <input name="projectId" type="hidden" value={props.projectId} />
      <label>
        Vehicle
        <input defaultValue={props.name} maxLength={120} name="name" required />
      </label>
      <label>
        Registration
        <input
          defaultValue={props.registration}
          maxLength={32}
          name="registration"
          required
        />
      </label>
      <label>
        Status
        <select defaultValue={props.status} name="status">
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <Feedback state={state} />
      <button className="button secondary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export function ProjectDeleteForm({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [state, action, pending] = useActionState(deleteProject, initialFormState);
  return (
    <form action={action} className="inline-form">
      <input name="workspaceId" type="hidden" value={workspaceId} />
      <input name="projectId" type="hidden" value={projectId} />
      <Feedback state={state} />
      <button className="button danger" disabled={pending} type="submit">
        {pending ? "Removing…" : "Remove vehicle"}
      </button>
    </form>
  );
}

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(inviteMember, initialFormState);
  return (
    <form action={action} className="form-stack">
      <input name="workspaceId" type="hidden" value={workspaceId} />
      <label>
        Existing account email
        <input name="email" required type="email" />
      </label>
      <label>
        Role
        <select defaultValue="editor" name="role">
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      <Feedback state={state} />
      <button className="button secondary" disabled={pending} type="submit">
        {pending ? "Inviting…" : "Invite member"}
      </button>
    </form>
  );
}

export function NoteCreateForm({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [state, action, pending] = useActionState(createNote, initialFormState);
  return (
    <form action={action} className="form-stack">
      <input name="workspaceId" type="hidden" value={workspaceId} />
      <input name="projectId" type="hidden" value={projectId} />
      <label>
        Vehicle note
        <textarea maxLength={4000} name="body" required rows={3} />
      </label>
      <Feedback state={state} />
      <button className="button primary" disabled={pending} type="submit">
        {pending ? "Adding…" : "Add note"}
      </button>
    </form>
  );
}

export function NoteEditForm({
  workspaceId,
  projectId,
  id,
  body,
}: {
  workspaceId: string;
  projectId: string;
  id: string;
  body: string;
}) {
  const [state, action, pending] = useActionState(updateNote, initialFormState);
  return (
    <form action={action} className="note-edit-form">
      <input name="workspaceId" type="hidden" value={workspaceId} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="id" type="hidden" value={id} />
      <label>
        Edit note
        <textarea defaultValue={body} maxLength={4000} name="body" required rows={3} />
      </label>
      <Feedback state={state} />
      <button className="button secondary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save note"}
      </button>
    </form>
  );
}

export function NoteDeleteForm({
  workspaceId,
  projectId,
  id,
}: {
  workspaceId: string;
  projectId: string;
  id: string;
}) {
  const [state, action, pending] = useActionState(deleteNote, initialFormState);
  return (
    <form action={action} className="inline-form">
      <input name="workspaceId" type="hidden" value={workspaceId} />
      <input name="projectId" type="hidden" value={projectId} />
      <input name="id" type="hidden" value={id} />
      <Feedback state={state} />
      <button className="button danger" disabled={pending} type="submit">
        {pending ? "Deleting…" : "Delete note"}
      </button>
    </form>
  );
}

export function SummaryForm({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [state, action, pending] = useActionState(
    summarizeProject,
    initialFormState,
  );
  return (
    <form action={action} className="form-stack">
      <input name="workspaceId" type="hidden" value={workspaceId} />
      <input name="projectId" type="hidden" value={projectId} />
      <p className="muted">
        The mock provider treats notes as untrusted data and retries malformed
        output once. Only schema-validated summaries are stored.
      </p>
      <Feedback state={state} />
      <button className="button primary" disabled={pending} type="submit">
        {pending ? "Summarizing…" : "Summarize vehicle"}
      </button>
    </form>
  );
}
