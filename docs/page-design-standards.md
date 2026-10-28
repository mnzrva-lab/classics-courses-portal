# Student library page design standards

**Status:** approved reference for public course and class pages, 2026-10-28.  
**Visual source:** the user-approved screenshot of **The Eye of Courage** course page, with a rounded split card and the course content below it. The matching live reference route is `/other-programs/eye-of-courage`. This specification and the shared components are the persistent implementation reference.

## 1. Course / term / offering overview

Use `LibraryCourseHero` from `components/library-course-hero.tsx`, preceded by linked breadcrumbs (`.offering-breadcrumbs`). Never implement a new independent hero for another course.

The shared course hero:
- With verified artwork: **42% photo on the left, 58% factual course copy on the right** on desktop; rounded ~30 px card, warm white copy area, minimal border and subtle shadow.
- Copy order: small red eyebrow (program/term), **one main H1**, optional substantive subtitle, factual date/location/teacher or schedule metadata, optional description and existing action links. Do not introduce duplicated headlines or made-up fields.
- **Image behavior:** native image with informative alt text; `object-fit: cover` within the tall left panel on desktop, keeping the figure/subject in view through `object-position`. On screens ≤820 px the image stacks first at a **16:9** aspect ratio above the text. Preserve original image bytes; do not crop or edit the source image.
- No verified photo: **no empty left side or generic stock placeholder**. Use the same rounded text-only hero variant.
- Below the hero: use the actual source-driven class list, course materials, or future schedule, with heading eyebrow and H2. Each entry links to the proper class.
- Data belongs in catalogs or the approved private content repository where already configured. Design components must not hardcode invented lesson or teacher details.

Examples: `/living-lam-rim/term-7` uses the original WebP in `public/images/living-lam-rim/term-7/BG.webp`; `/other-programs/eye-of-courage` uses the supplied Eye of Courage WebP; Classics Courses 8 (Taiwan 2026), 16, 17 and 18 use their verified original covers from `public/images/classics/`. Pages without supplied covers, such as Perfection of Wisdom, remain text-only. Do not substitute generated images.

## 2. Class / session detail

Each standard class route uses the shared components:
1. **Breadcrumbs** link back to the course and identify the class.
2. `LibraryClassHeader` gives the program eyebrow, one H1 for the actual class name, and verified date/teacher/duration metadata. Missing source details are omitted, not guessed.
3. `LibraryClassSection id="recording"` displays the recording first, or the existing clear unavailable-state message.
4. Source-backed **Study Notes**, **Reference Transcript** (`id="transcript"`) and materials follow, when applicable. Keep download links, warnings, paragraph citations, word-level anchors and reader controls. Do not invent files for unavailable content.
5. **ClassSequenceNavigation** provides previous, all classes, next. Keep each URL and existing navigation semantics.

The Eye of Courage class keeps its approved study tabs and optional workshop. The archive session route retains its reader variants. Shared header and recording styling still apply.

## 3. Mobile, accessibility and editorial integrity

- Desktop split layout stacks at 820 px; phone views retain legible headings and metadata, with sufficient padding and no horizontal scroll.
- Images have descriptive alt text; no alt/title overlay on top of broken images. Confirm that the image URL returns a real file.
- Never replace a source's author, teacher, course title, schedule, reference text or video link while changing layout.
- Preserve the original uploaded artwork. Images are currently stored in **GitHub**, then served through **Netlify**. No external image database or Supabase migration is part of this standard.
- Source documents, transcripts, citations, highlighted passages and teacher notes are separate from visual layout and must remain stable.

## 4. Enforcement and review

`docs/page-standards-registry.json` declares every existing public route under the Classics, Living Lam Rim, Perfection and Other Programs / archive trees as **index**, **course**, **class**, **delegate-course**, **delegate-class**, or an explicitly explained exception.

`node scripts/check-page-standards.mjs` runs on each push to `preview-staging`. It fails if:
- a new public page is missing from the registry;
- a declared course/class page bypasses the shared components;
- a standard class lacks its recording/transcript anchors or class navigation;
- an exception has no documented reason;
- the approved shared layout and mobile breakpoint contract is removed.

The GitHub Actions workflow also builds the app and checks live rendered preview routes and the unchanged Term 7 image bytes.

**Manual review remains necessary** for desktop/mobile visual appearance, text readability, functioning links and real image loading. The CI tests enforce structural rules; they cannot fully inspect visual fidelity. Keep PR #2 draft until the human review is complete.

## 5. Documented exceptions

- `app/courses/[courseSlug]/[offeringSlug]/[sessionSlug]/page.tsx`: legacy Supabase-backed implementation; not the active source-based route. Do not silently retrofit it without a migration decision.
- `app/other-programs/eye-of-courage/class-2/workshop/page.tsx`: standalone interactive workshop; specialized controls are intentional. The ordinary class page still follows the class standard.
- Collection index pages and page delegates are **not individual course/class details**; their role is recorded in the registry, and the delegated components are validated.

To introduce another exception, document its rationale in the registry and in the relevant PR. Never silently disable a failing standard.
