# Private content management in the existing Library

## Student navigation

There is **one** public Library, with its existing Classics Courses, Living Lam Rim, Perfection of Wisdom and Other Programs sections. Publishing through private GitHub never creates another public section or duplicate course page.

For Classics Courses, students continue to use:

- `/courses` (the existing 18-course grid)
- `/courses/course-17` (the existing course and its Arizona, Kyoto, Taiwan, etc. offerings)
- `/courses/course-17/kyoto-2027` (an offering when published)
- `/archive/classics/course-17/kyoto-2027/class-1` (a class when published)

Previously shared development-only `/library` links redirect to the original Classics hierarchy. The small numbered badge in `LibrarySessionList` is only for class codes such as C1, never long course titles.

## Internal content files

The private GitHub repository contains `published/library/index.json`, an internal publishing registry, **not** a new website. Existing ACI 17 is registered as `source: existing-aci17` and continues to use its original, approved ten transcripts and canonical links.

A **new or updated Classics offering** can use `source: managed-v1` with:

- Index entry: `{ "programSlug": "classics-course-17", "offeringSlug": "kyoto-2027", "source": "managed-v1" }`
- `published/library/classics-course-17/kyoto-2027/manifest.json`
- Optional `published/library/classics-course-17/kyoto-2027/class-1/transcript.json`
- Optional `published/library/classics-course-17/kyoto-2027/class-1/study-notes.md`

The manifest has `schemaVersion: 1`, matching `programSlug`/`offeringSlug`, verified `programTitle`, `offeringLabel`, `kind`, and ordered `sessions`. A session has required `slug`, `code`, `title`; optional `date`, `teacher`, `duration`, HTTPS `recordingUrl`, `transcript`, `studyNotes` and approved HTTPS `materials`. The schema and files are validated on upload.

The same offering slug is inserted once in the course's existing offering list, preserving its position if it was already present. Adding a session to the manifest creates the class in the *existing* archive URL. Students do not see the registry, file types, or approval statuses. Nothing requires an additional editorial approval.

## Constraints

- ACI 17 originals, timestamps, citation anchors and live page design are preserved; Course 18 remains ongoing; Course 8 Taiwan transcript replacement is deferred.
- This currently integrates *new managed offerings* into the existing 18 Classics Courses. Other program families must be wired into their respective existing sections, not a new Library.
- New generic offerings use the standard class reader, transcript notice, timed/untimed transcript rendering, TXT/DOCX downloads, Study Notes and materials. Generic full-text search and Tibetan glossary integration still require the unified content-index task; ACI 17 is already indexed.
- Images/PDFs must have an already public URL; a file in the private content repository is not automatically a public file.
- The website refreshes published files on a short server cache, approximately 60 seconds. No new build should be needed for valid file-only updates, subject to an end-to-end content-only verification.
- Source availability problems retain the original local offerings as a fallback where present, and unregistered or invalid new routes do not become public.

## End-to-end disposable publishing verification (October 28, 2026)

A private **test-only content branch** hosted a fictional two-class offering under ACI 17. The approved private `main` collection never received the fictitious content, and the website's production `main` never changed.

The actual deploy preview passed three HTTP-based GitHub Actions checks:

- **Create:** [successful run](https://github.com/mnzrva-lab/classics-library-content/actions/runs/40740755724). Verified original Course 17 listing, offering and two class URLs, existing image and sample YouTube link, placeholder transcript and Study Notes, and all four TXT/DOCX downloads.
- **Edit:** [successful run](https://github.com/mnzrva-lab/classics-library-content/actions/runs/40741066035). Changed title, cover reference, recording URL, transcript and Study Notes entirely in private GitHub. Verified new content and absence of old markers in pages and downloads without any Netlify website redeployment.
- **Delete:** [successful run](https://github.com/mnzrva-lab/classics-library-content/actions/runs/40741257807). Removed the fictional manifest, transcript, notes and catalog entry. Verified the offering disappeared, temporary URLs returned HTTP 404, and real ACI 17 remained available, again without a Netlify redeployment.

The private test branch's current index is byte-for-byte identical to private `main`, with zero remaining fictional offering files. After testing, the temporary code override that read the test branch was removed byte-for-byte from `lib/public-content.ts`; the development preview and production both return to reading approved `main`.

**Limits:** This test demonstrates content changes for an offering **inside the 18 Classics Courses**, not an independent Harmony for Health/Other Programs page. Artwork was swapped between already-hosted website images; uploading a brand-new image through private GitHub was **not** tested or enabled. Automatic Search/Tibetan indexing of future generic offerings remains a separate development task. The one-minute refresh policy is approximate and was verified by retries, not assumed to be instantaneous.
