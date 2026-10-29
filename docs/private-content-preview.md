# Private GitHub content: preview integration

The Library's published source content is stored in the **private** repository
`mnzrva-lab/classics-library-content`.

The website loads approved Markdown server-side through `lib/public-content.ts`.
Only the allowlisted `published/perfection-of-wisdom/overview.md` is connected
during this pilot. The local description is preserved as an outage fallback.

## Netlify configuration

- Environment variable name: `LIBRARY_CONTENT_GITHUB_TOKEN`
- Value: GitHub fine-grained token scoped exclusively to `classics-library-content`, Contents **read-only**
- Netlify context: **Deploy previews**
- Scopes: **Builds and Functions** (Runtime may also be selected)
- Mark as **Secret**
- Never use the `NEXT_PUBLIC_` prefix or commit token values

An environment-variable change takes effect after a **new preview build**.
Editing a Markdown file in the private content repository afterward does not
require another Netlify website build.

## Preview verification

1. Visit the current PR preview's `/perfection-of-wisdom` page.
2. The preview-only source indicator should say **Private GitHub Markdown preview**.
3. If the indicator says **Preview fallback: private content not connected yet**,
   verify the token's scope, repository access, environment context, and that
   the preview deployment was built after the environment variable was added.
4. Change an *approved* phrase in the private Markdown file and refresh the
   page to confirm the new text appears without rebuilding the application.
5. Revert the test phrase before production release.

Content displayed on a public website is public even when its source
repository is private. Do not publish drafts or restricted materials.

Production must not be merged or redeployed until explicitly approved.
