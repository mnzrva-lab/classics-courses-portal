# File-based teaching publishing

## One public Library

Private GitHub is the content editor behind our **existing** Library. It does not create a new public Library section or additional student-facing navigation. Ordinary content edits do not require a Netlify website deployment.

- Classics Course N (1–18): existing `/courses/course-N` offering list; its classes use existing `/archive/classics/course-N/<offering>/<session>` links.
- Standalone teaching: existing **Other Programs** section and one `/other-programs/<teaching-slug>` page. No invented term or class.
- Existing ACI 17 material, Course 18 ongoing records and Course 8 Taiwan's current transcripts retain their separate legacy sources until deliberately migrated.

### To add or update a Classics offering

Create or edit files in the **approved** private content repository:

```text
published/library/classics-course-17/
  cover.webp                            optional shared course image
  kyoto-2027/
    manifest.json                       required offering and class information
    cover.webp                          optional offering-specific image
    class-1/
      transcript.json                   optional when manifest says transcript:true
      study-notes.md                    optional when manifest says studyNotes:true
```

A sample shape (replace all placeholder values with approved material):

```json
{
  "schemaVersion": 1,
  "programSlug": "classics-course-17",
  "offeringSlug": "kyoto-2027",
  "programTitle": "VERIFIED COURSE TITLE",
  "offeringLabel": "VERIFIED OFFERING LABEL",
  "kind": "Classics Course",
  "sessions": [
    {
      "slug": "class-1",
      "code": "C1",
      "title": "VERIFIED CLASS TITLE",
      "recordingUrl": "https://www.youtube.com/watch?v=VERIFIED_VIDEO_ID",
      "transcript": false,
      "studyNotes": false
    }
  ]
}
```

Set `transcript: true` or `studyNotes: true` only when the corresponding file exists and passes validation. Recordings, dates, teacher fields, source links and titles are never invented automatically.

### To publish a standalone teaching

Use the same approved private repository, in an Other Programs folder:

```text
published/library/other-programs/harmony-for-health/
  manifest.json
  cover.webp              optional
  transcript.json         optional
  study-notes.md          optional
```

Standalone manifest has `schemaVersion:1`, `teachingSlug` matching its folder, and required `title`. Optional fields: `subtitle`, `teacher`, `date`, `description`, `recordingUrl`, `transcript`, `studyNotes`, `artwork`, `artworkAlt`, `materials` (approved HTTPS links). No artificial class or term folder. The example folder above is **not** populated with real Harmony for Health material; publish it only once the approved source files are supplied.

### Automatic covers, with no empty placeholders

- An offering's `cover.webp` is used first.
- If absent, Classics may use `classics-course-N/cover.webp`.
- If neither file exists, existing explicitly configured website artwork can be used; otherwise the course has a properly styled **text-only** hero with no blank image column.
- A standalone teaching uses its own `cover.webp`, its explicitly configured artwork, or text-only layout.
- The private cover route serves only registered published WebP images, validates the header and file size (max **4 MB**), never reveals the private GitHub token, and refreshes after changes. Replace or delete the binary file to update the displayed image. The site response cache makes refresh approximate, not instantaneous.

### Automatic Library registration and Search

The private GitHub workflow runs after content commits on `main`:

1. Discover valid supported manifest folders. It generates `published/library/index.json` automatically, keeping the original ACI 17 alias. An editor **does not edit the index manually**.
2. Validate manifests, images, transcript timing claims, stable paragraph IDs and notes. A missing file flagged as available is an error.
3. Generate `published/search/manifest.json` and immutable `published/search/parts/*.json` shards from the **same validated source files**. Students' exact searches, related-word suggestions and source-marked Tibetan glossary references use these generated shards plus existing legacy sources.
4. Commit the generated index and shards in the same private GitHub commit. No Netlify website build is necessary for ordinary content changes.

**Deleting a published folder** removes its offering and search records from the generated registry on the next workflow. Existing shared URLs then return 404 for deleted managed content. The content repository history remains as an audit trail.

Do not hand-edit generated `published/library/index.json` or `published/search/` files. Automatic generation runs on GitHub Actions; uploading source files is not instantaneous publication. Expect the GitHub job plus the website's normal caching/revalidation interval.

### Safety and release

- Approved-on-upload policy remains: no second editorial approval. Validation checks technical correctness, not whether the teaching is approved.
- Only use material cleared for public display. Keep drafts, student data, tokens and unfinished Living Lam Rim transcript replacements out of `published/`.
- Production still needs a secure, server-only, read-only private-content token in its **production Netlify environment** before the final website release. Do not put secrets in GitHub source files.
- Preview was tested using **fictional private-branch** content. Restore the preview source to private `main`, verify source guards, and keep website production PR #2 draft until a production release is explicitly authorized.

## Verified QA (October 28, 2026)

- Successfully created a fictional Classics offering from a manifest and an uploaded WebP cover.
- Successfully created a fictional standalone teaching inside Other Programs with a text-only hero.
- Live Search, Tibetan source links and TXT/DOCX downloads were checked on the actual Netlify development preview.
- See the private QA workflow history for edit and deletion results. No fictional material belongs in approved private `main`.
