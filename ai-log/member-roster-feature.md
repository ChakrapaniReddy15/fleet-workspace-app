# Member roster feature implementation note

This is an implementation note, not a conversation transcript.

## Decision

Add a read-only roster to the owner-only Team Access panel. The roster shows
display names and roles for the current workspace only. A person in multiple
workspaces appears independently in each workspace with that workspace's role.
Do not expose email addresses or broaden direct profile-table access.

## Implementation

- Added `list_workspace_members`, a `SECURITY DEFINER` RPC with a fixed
  `search_path`, explicit owner-role check, and workspace filter.
- Left profile RLS self-only. Non-owner and cross-workspace RPC calls return
  zero rows.
- Added the owner-facing roster and role badges next to the invite form.
- Added integration coverage for tenant boundaries, owner authorization, and a
  shared user's different role in each workspace.
- Documented the feature and its privacy boundary in the README.

## Verification

- `npm run db:reset`
- `npm test` — 7 tests passed
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- Browser checked the owner roster for both seeded workspaces.
