# Library content pilot

This public-content folder is the first test of content updates without a Netlify application rebuild.

**Preview-only source:** `library-content-pilot` branch. It is intentionally separate from `preview-staging` (the website build branch).

## Test file

`perfection-of-wisdom/overview.md`

Edit this UTF-8 Markdown file to change the overview on the staging Perfection of Wisdom page. The staging website fetches it at request time from the public GitHub raw URL. Changes can take several minutes to appear because of upstream and browser caches. No Netlify build is necessary for edits to this source-only branch.

The rest of the course metadata (title, subtitle, playlist, schedule, sessions) remains in the existing website until the content pipeline is extended.

## Boundaries

- This branch is a **temporary proof**, not the final separate content repository.
- No admin UI, student account, or Supabase is required.
- Do not store secrets or private/draft teaching materials here. This is a public repository.
- Content must be approved before publishing.
- The website retains its original local introduction as a fallback if the remote file cannot be fetched.
- To migrate later, create a public `mnzrva-lab/classics-library-content` repository, move `public-content/` into it, and change the server-side allowed base URL in the website preview before production release.

## QA checklist

1. Check the latest PR staging deploy is ready.
2. Load `/perfection-of-wisdom`; its origin label should read `GitHub Markdown preview`.
3. Change `perfection-of-wisdom/overview.md` in this branch only.
4. Refresh the staging page after GitHub's raw-content cache expires.
5. Confirm the new wording and **unchanged** Netlify deploy ID.
6. Revert any temporary test wording before publishing this approach to production.
