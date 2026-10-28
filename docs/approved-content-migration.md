# Approved-on-upload content migration

This branch is the start of the website's migration away from Supabase and bundled teaching data. Student accounts, Admin, and My Notes are excluded from the launch scope; their old implementation must be archived and checked for dependencies before removal.

## Editorial publishing policy

Only finalized, approved teaching material is uploaded to `mnzrva-lab/classics-library-content`. A valid change to `main/published/` is eligible to appear automatically on connected website pages. Do not introduce a second review or confirmation button. Automated format validation remains mandatory, and editors should inspect the rendered result.

## First vertical slice: ACI Course 18

The private repository stores `published/classics/course-18/schedule.json` and `published/classics/course-18/recordings.json`. The website reads both on the server through `LIBRARY_CONTENT_GITHUB_TOKEN`. The recording manifest is validated, and the local copy is a known-good fallback if the source cannot be reached. This preserves Classes 1–4 and permits verified new recordings to appear without deploying new website code.

The older hardcoded recording JSON is retained **only as a temporary fallback**, not as the editor's source. Do not delete it until the private source is operational in production and the failure-handling policy is agreed.

## Next milestones

1. Confirm the private content connection and recording updates in a Netlify preview. The preview must have the server-only token.
2. Archive legacy Supabase code on a separate branch before removing active imports. Do not delete any database or credentials as part of this stage.
3. Migrate one whole course (metadata, recordings, transcripts, Study Notes and schedule) and verify the same source drives pages and search.
4. Design the general content manifest and eventual simple editor. A published upload should be live automatically, subject to validation and caching.
5. Address Netlify access and GitHub repository privacy separately. The site remains publicly readable, even if both source repositories become private. Do not change production settings as part of development.

