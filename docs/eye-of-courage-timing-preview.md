# Eye of Courage: SRT timing on the preview site

Source of truth: private classics-library-content / aci17-preview-2026 / staging/other-programs/eye-of-courage.
Website integration: classics-courses-portal / preview-staging only. No production deployment or merge approved.

Existing rendered paragraph text, speaker labels, chapter IDs, citation links and image handling have been preserved. This commit adds startSeconds and timingSource metadata using a separate ID-keyed map.
The V3 private JSON remains the authoritative corrected transcript source. Updating website wording later requires its own source synchronization and legacy-ID/image-path review.

## QA

| Class | Website paragraphs | Corrected source paragraphs | Chapters | Direct | Estimated |
|---|---:|---:|---:|---:|---:|
| 1 | 163 | 163 | 23 | 152 | 11 |
| 2 | 214 | 163 | 30 | 101 | 113 |

Validated unique stable IDs, nondecreasing timestamp values, video IDs, and chapter start derived from the first displayed paragraph.
The Class 2 website contains 214 smaller passages, but the reviewed Markdown master contains 163. Matching used chapter context and content, not numeric index. Several bullet-list passages share approximate times.
Unspoken stage directions in {...} inherit adjacent spoken navigation times and are not marked direct. Paragraph estimates show ~, but chapters have no separate review label.
V3 master Class 2 P093 at 01:06:13 maps to original website class-2-paragraph-90.
V3 master Class 2 P129 at 01:40:11 maps to original website class-2-paragraph-146.
Ten audio spot-checks remain in the V3 QA. P001/P003/P004 were applied to Class 2 in V3 despite being listed under Class 1 by the reviewer, as documented in the V3 report.
