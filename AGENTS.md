# Working rules for the Classics Courses Portal

This file is repository guidance for agents, maintainers and contributors. **Read [docs/page-design-standards.md](docs/page-design-standards.md) before changing public course or class UI.**

## Preview and source safety
- Current changes go to the `preview-staging` branch / **draft PR #2**, not the production branch. Do not merge, publish production, change deployment destinations, or change credentials without explicit authorization.
- Course metadata, transcripts and original artworks come from verified source files. Do not invent teachers, class dates, recordings, testimonials, images or end dates.
- **GitHub is the current photo store.** Store verified public photos under `public/images/<program>/<offering>/`; reference them by root-relative paths. Never re-encode, duplicate or resize the original just to change its filename.
- This GitHub-backed preview does **not use Supabase** for course photos. Legacy Supabase implementation files remain in the codebase and are not permission to introduce a backend dependency.

## Approved public page UI
- Course/term/overview pages: breadcrumbs, then `LibraryCourseHero` (`components/library-course-hero.tsx`). The approved Eye of Courage reference has a **42% left photo / 58% right information** split. No photo means the **same card with text only**; do not invent artwork.
- Class/session pages: breadcrumbs, `LibraryClassHeader`, `LibraryClassSection` for recording and transcript, any verified study notes/materials, and `ClassSequenceNavigation`. Eye of Courage retains its authorized study-tab/workbook specialization.
- Preserve existing URLs, ids (`#recording`, `#transcript`, `#study-notes`), original wording, citation anchors, transcript provenance notes, and student navigation. A visual change does not authorize a content rewrite.
- Responsive styles live in `app/library-page-standards.css`; preserve mobile reading sizes and avoid overflow. Artwork must have useful alt text.

## Before every public page change
1. Check the **role** of the route in `docs/page-standards-registry.json`. Add any new page and declare its role. A justified exception needs a reason in the registry.
2. Reuse the shared layout components rather than copying JSX or making another program-specific hero.
3. Run `node scripts/check-page-standards.mjs` and `npm run build`; GitHub Actions runs both as well as rendered-route smoke checks.
4. Review a desktop and mobile page for source accuracy, image cropping, legibility and working content links. Automated source checks **do not replace visual QA**.
5. Confirm preview deployment ready and PR remains draft. Never report a live page while deployment is still pending.

See `docs/page-design-standards.md` for the full specification and known exceptions.

## Schedule-first class lists
- Course 16: show ten individual verified class recording links directly on the course hub, sourced from the archived class JSON.
- Course 18: split five paired teaching dates into ten individually linked class pages, but never split an unverified block time into invented class-specific times.
- Living Lam Rim Term 7: list the first ten recurring Mondays as **C1 / Class 1** through **C10 / Class 10**, with the correct date shown under each title, matching Course 18. Each date-linked class page has the same derived Class # heading. These displayed ordinals are not proof of an official ten-class limit; don't invent a final date or teaching materials.
- Keep unlinked Reading materials hidden until approved URLs are ready. Do not discard source PDFs or fabricate URLs.
