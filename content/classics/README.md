# Classics Library content

This directory is the source of truth for public Classics Library content.

## What belongs here

- Course and Course Offering metadata
- Session/class metadata
- Transcript text and stable paragraph IDs
- Transcript timestamps
- Study Notes
- Search metadata
- Small public transcript/reference images when appropriate
- Links to externally hosted recordings and large files

## What does not belong here

- Large lecture video files
- Large audio archives
- Secrets or private access tokens
- Student-private notes, bookmarks, or progress

Large media should remain in an external media/file host and be referenced by URL from the Library content.

## Publishing workflow

1. Add or update structured content on `preview-staging`.
2. Netlify builds the Deploy Preview.
3. Verify course navigation, recordings, transcript structure, timestamps, images, Study Notes, and search behavior.
4. Only merge/publish to `main` after the preview is approved.

## Course 8 Taiwan migration

Course 8 Taiwan 2026 is the first Library Offering being moved away from live Supabase reads. Its schedule, available recording links, and recovered-content status are stored in `course-08/taiwan-2026.json`.

Recovered transcripts and Study Notes are migrated as separate content files so they can be validated independently before student pages depend on them.
