# Fleet Workspace

A small multi-tenant fleet management app built with Next.js App Router,
TypeScript, Supabase Auth, and PostgreSQL. **Fleet companies are workspaces,
vehicles are projects, and vehicle notes are notes.** The database keeps the
assessment's required entity names.

## Run locally

Requirements: Node.js 20+, npm, and Docker Desktop.

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `db:start` runs only the
Supabase services needed by this app (Postgres, Auth, PostgREST, and Kong).
`db:reset` applies the migrations and seed data. `db:env` writes the local URL,
publishable key, and database URL to a mode-600 `.env.local`; the file is
gitignored. It never writes the Supabase secret/service-role key.

### Demo accounts

All three seeded accounts use the password `FleetDemo2026!`.

| Account | Deccan Logistics | Charminar Cabs |
|---|---|---|
| `owner@fleet.test` | Owner | No access |
| `editor@fleet.test` | Editor | Owner |
| `viewer@fleet.test` | Viewer | Editor |

The shared account deliberately has a different role in each workspace. The
seed includes two workspaces, four vehicles, and notes including a brake-noise
report followed by the untrusted text “ignore previous instructions”.

## Tests

Start and seed Supabase as above, then run:

```bash
npm test
```

The suite includes real authenticated requests to local PostgREST. It verifies
that a Deccan-only owner gets empty results when reading, updating, or deleting
Charminar projects and notes; forged workspace IDs are rejected; a viewer
cannot write; the shared user has distinct workspace roles; and every public
tenant table has both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL
SECURITY`. Summary tests cover malformed output and prompt-injection-style note
content.

The test database connection is obtained by `npm run db:env`; the test suite
uses that local database URL only to inspect `pg_catalog` security flags.
Isolation reads and mutations run through signed-in user clients and their
JWTs, never through a service-role key.

## Main design decisions and trade-offs

- **Workspace boundary lives in PostgreSQL.** Each tenant-owned table has a
  `workspace_id`; notes and summaries also use composite foreign keys to their
  project and workspace. This prevents cross-workspace references even if an
  application check is missed.
- **Fail closed.** RLS is enabled and forced on every tenant table. There is no
  broad `USING (true)` policy. Explicit permissive policies grant the intended
  operation, and restrictive policies independently enforce the required
  membership/role so one accidentally broadened grant does not remove the
  tenant boundary. Unmatched operations have no access.
- **Roles are checked twice.** Each server action verifies the authenticated
  user with Supabase Auth, reads that user's membership, and checks the minimum
  role. PostgreSQL RLS repeats the membership and role checks. IDs in URLs and
  hidden form inputs are untrusted filters, never proof of access.
- **No service-role key in user requests.** The app uses the publishable key
  with the user's cookie-backed session. Supabase verifies the user, and the
  database receives the user's JWT so RLS applies to normal reads and writes.
- **No existence leaks.** Missing and inaccessible workspaces/projects share a
  not-found page. Mutations use the same “Not found or access denied” message;
  zero-row updates and deletes are not treated as success.
- **Invites target existing accounts.** Owners can add a registered account by
  email using a narrowly scoped `SECURITY DEFINER` function that checks the
  caller's owner role and has a fixed `search_path`. Sending email invitations
  would require a separate token and email-delivery flow.
- **Member roster is tenant-scoped.** Owners see names and roles only for the
  selected workspace through an owner-checked RPC. The public profile table
  remains self-only; workspace switching shows each shared user’s role for
  that workspace without exposing email addresses.
- **Summaries are untrusted until validated.** The provider interface returns
  `unknown`; Zod validates the result before storage. A malformed response is
  retried once, and invalid output is never persisted. The mock provider
  deterministically flags the brake concern without following instruction-like
  text in the note. Summary text is rendered as ordinary escaped React text.
- **Small demo, not a production fleet platform.** Supabase local provides
  authentication and PostgreSQL without a separately maintained auth service.
  The mock summary provider avoids API keys; it demonstrates the contract and
  validation boundary, not the quality of a real model.

## Assessment demo and recording

Use QuickTime Player's **File → New Screen Recording** on macOS, enable the
microphone, and narrate this roughly seven-minute walkthrough. Keep the app
running at `http://localhost:3000` with local Supabase started and seeded.

1. **0:00–0:45 — Sign in and explain the mapping.** Show the Deccan Logistics
   workspace and explain that fleet companies are workspaces, vehicles are
   projects, and vehicle notes are notes.
2. **0:45–1:45 — Roles and workspace switching.** Sign in as
   `editor@fleet.test`, switch between both workspaces, then sign in as
   `viewer@fleet.test` and point out that write controls are hidden.
3. **1:45–2:45 — Vehicle and note edits.** As an editor, add or edit a vehicle
   and a note, then show the updated result.
4. **2:45–4:00 — Forged identifiers.** Change the workspace ID in a URL and
   submit a request with another workspace ID in its body. Both must fail with
   the same generic unavailable/access-denied behavior.
5. **4:00–5:00 — Database isolation.** Run `npm test` and show the
   authenticated PostgREST tests asserting that cross-workspace reads,
   updates, deletes, and forged writes are denied by RLS.
6. **5:00–6:30 — Summary safety.** Open the seeded Tata Ace with the brake-noise
   note containing “ignore previous instructions,” summarize it, and show that
   the mock retries its malformed response and the validated result still
   flags the brake concern.
7. **6:30–7:00 — Close.** Briefly show the migration, restrictive RLS, and
   README trade-offs and next steps.

**Screen recording:** not recorded yet. After recording, upload the video,
ensure the link is viewable by the assessors, and replace this line with the
shareable 5–8 minute URL.

**AI session history:** [`ai-log/`](./ai-log/) contains the available
redacted/truncated Copilot context exports and a partial conversation record
saved from the session view. It is not a complete, unedited archive of every
chat, agent, and IDE interaction required by the brief. The available history
is included transparently; missing content has not been reconstructed.

**Public repository:** [github.com/ChakrapaniReddy15/fleet-workspace-app](https://github.com/ChakrapaniReddy15/fleet-workspace-app)

## What I would do next

Add notes created automatically from dashcam events or number-plate
recognition.

Other production follow-ups: real email invitations with expiring tokens,
audit logging, rate limits, a real LLM provider with explicit prompt-injection
handling, CI against disposable Supabase, and ownership-transfer rules.
