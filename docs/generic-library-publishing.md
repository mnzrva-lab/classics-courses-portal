# Reusable Library publishing v1

## Purpose

New approved programs, offerings and classes can be added through **private GitHub content only**. The public website discovers them on its next content refresh, normally within about one minute. No additional editorial approval click or application deployment is required for existing supported file types.

**ACI 17 remains the verified reference.** Its ten classes continue to use their original public URLs and existing private source transcripts, without copying, editing or rewriting them. The central index registers it as an existing program. Course 18 remains ongoing; Course 8 Taiwan transcripts must not be migrated until their replacements are supplied.

## What an uploader adds

The private repository must contain:

    published/library/index.json
    published/library/<programSlug>/<offeringSlug>/manifest.json
    published/library/<programSlug>/<offeringSlug>/<sessionSlug>/transcript.json
    published/library/<programSlug>/<offeringSlug>/<sessionSlug>/study-notes.md

Only the index and manifest are required for a new offering. Transcript and Study Notes files are optional, and only required for sessions explicitly marked as having them. An upcoming class can appear with just its title.

Add to the approved index, retaining existing entries:

    {
      "programSlug": "new-program",
      "offeringSlug": "winter-2027",
      "source": "managed-v1"
    }

Example manifest **structure only**, not teaching content approved for publication:

    {
      "schemaVersion": 1,
      "programSlug": "new-program",
      "offeringSlug": "winter-2027",
      "programTitle": "USE VERIFIED COURSE TITLE",
      "offeringLabel": "USE VERIFIED OFFERING LABEL",
      "kind": "Course",
      "sessions": [
        {
          "slug": "class-1",
          "code": "C1",
          "title": "USE VERIFIED CLASS TITLE",
          "transcript": false,
          "studyNotes": false
        }
      ]
    }

After approved content is uploaded and the index is updated, the portal creates:

    /library/new-program/winter-2027
    /library/new-program/winter-2027/class-1

Add another session to the manifest to create another class page automatically. The provided session order becomes the previous/next navigation order. Class names, dates, teachers and recording links are never invented or derived from filenames.

## Supported fields

**Offering:** required schemaVersion=1, programSlug, offeringSlug, programTitle, offeringLabel, kind, sessions. Optional description, artwork, artworkAlt, playlistUrl.

**Class:** required slug, code, title. Optional date, teacher, duration, recordingUrl (HTTPS), transcript (boolean), studyNotes (boolean), materials (up to 20 approved HTTPS links, each with label and url).

**Transcript JSON:** schemaVersion=1, sessionId matching the class slug, timingStatus (unverified or youtube-caption-aligned), chapters containing stable id, title, startSeconds and nonempty paragraphs with id, speaker, text and startSeconds. When unverified, all startSeconds must be null and there are no timing claims. When aligned, the correct youtubeVideoId, monotonic paragraph timestamps and timingSource (youtube-caption with youtubeCueLine, or estimated without one) are mandatory. Chapter start equals its first paragraph's time. The reader marks estimated times with ~.

**Study Notes:** plain UTF-8 Markdown in study-notes.md. The reading page and TXT/DOCX downloads use exactly this published file. Nothing needs to be copied into the website repository.

**Materials:** only direct, already publicly accessible HTTPS URLs. A private repository PDF or image is NOT automatically served to visitors. New uploaded artwork requires a separate hosting integration; for now reference a real image already present under the website /images/ paths, or omit artwork to keep the approved text-only hero.

## Security and reliability

- The only editable input is approved content inside the private repository. Its token stays server-only on Netlify, never in NEXT_PUBLIC_ variables.
- The server rejects unknown paths, invalid slugs, duplicate class IDs, bad file structure, unsupported links and mismatched YouTube timing. GitHub Actions also checks the catalog, every managed manifest and any flagged transcript/notes file.
- Broken or unreachable new offerings are not shown; existing ACI 17 pages and the rest of the published site are unchanged.
- The approved catalog, course pages and class files revalidate approximately once a minute. Temporary external/network failures can delay an update; this is not a promise of immediate global consistency.
- Approved files committed under published/ are eligible for display. No extra approval workflow exists.

## What remains separate

**Search and Tibetan glossary for newly registered generic programs** still require the next phase: a unified incremental published index. ACI 17 remains connected to both. We will not claim generic courses are searchable until the shared index is migrated and checked.

A friendly non-JSON content editor, arbitrary file/PDF uploads, secure media hosting and full removal of legacy Supabase code are also later phases. Do not delete the legacy data while those dependencies are audited.
