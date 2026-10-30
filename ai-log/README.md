# AI session exports

These JSON files preserve the session records available from Copilot's session
context export. Local home-directory identifiers, the repository owner's
GitHub handle in transcript text, and local Supabase credential values are
replaced with `[REDACTED]` markers before inclusion.

The Copilot context export is not a byte-for-byte IDE transcript and reports
the earlier planning session as truncated. Raw tool execution output is not
included in the export API response. These limitations are recorded rather
than presenting the files as unedited, complete raw transcripts.
