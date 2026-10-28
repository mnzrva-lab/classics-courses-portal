# Classics Courses Portal

Student teaching-library website for Classics Courses with Timothy Lowenhaupt, Living Lam Rim, Perfection of Wisdom, meditations, Study Notes and Reference Transcripts.

## Current development workflow

- **Preview:** [Netlify Deploy Preview #2](https://deploy-preview-2--thunderous-clafoutis-c6db2e.netlify.app/)
- **Development branch:** `preview-staging`
- **Review PR:** [draft PR #2](https://github.com/mnzrva-lab/classics-courses-portal/pull/2)
- **Production:** not changed until reviewed and explicitly approved.

Code and small original course images live in GitHub (`public/images/` for new artwork). The preview also reads selected validated teaching metadata from the private `mnzrva-lab/classics-library-content` repository. Some unused legacy Supabase routes remain in the code, but the current source-backed student pages do **not** require Supabase to display their course content or artwork.

## Page design contracts

- [Approved page-design standards](docs/page-design-standards.md)
- [Page registry and documented exceptions](docs/page-standards-registry.json)
- [Contributor/agent working rules](AGENTS.md)
- Shared course hero: `components/library-course-hero.tsx`
- Shared class header and sections: `components/library-class-header.tsx`, `components/library-class-section.tsx`
- Responsive layout: `app/library-page-standards.css`

## Validation

Run `node scripts/check-page-standards.mjs` before committing changes to course/class UI. GitHub Actions also runs the structural check, other source-data tests, `npm run build`, and rendered-page smoke checks before the preview is accepted.
