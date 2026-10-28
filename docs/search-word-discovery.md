# Search word-form discovery (English)

## Product behavior

- The existing **Exact phrase** and **All words (any order)** modes continue to search literal whole words. The same query gives the same main result count, snippet highlights and passage links as before this change.
- The separate **Related word forms** row offers actual indexed words and independent result counts. Clicking a suggestion starts a new exact search, retaining filters (archive, teacher and session type).
- Only when there are no exact results may the row also suggest **words beginning with** the typed prefix. Prefix completion does not turn partial words into search hits.
- No extra AI, search service, student account or tracking is needed. There are no invented or guaranteed suggestions.

## How it works

- General English noun plurals, irregular forms, verb tenses and adjective comparatives are normalized using the MIT-licensed [wink-lemmatizer 3.0.4](https://github.com/winkjs/wink-lemmatizer). The package uses the WordNet English lexicon and morphological exceptions. It runs **on the server** only, not in the search-result browser bundle.
- Additional close derivatives (e.g. `wise/wisdom`, `decide/decision`, `karma/karmic`, `create/creativity`) come from a conservative list in `lib/search-word-families.ts`. These entries may expand over time, but the editor does not need to enter related terms when uploading transcripts.
- Suggestions are intersected with the **current searchable vocabulary**. They display only if a separate exact search returns at least one matching result with the selected filters.
- The vocabulary has a memoized morphological index for inexpensive repeated searches. The source is the same existing bundled search material as the exact search. When published transcripts migrate to the private repository, **both** discovery and exact search must move to the same live search index in one task, to avoid stale suggestions or results.

## Limits and accuracy

- This is an English word-form feature, **not full semantic search or a thesaurus**. It is intentionally conservative: conceptual synonyms are not merged, and some unrelated homonyms might share a spelling or lemma.
- Tibetan transliteration and non-English word forms continue to use the precise existing search. Multiword searches are not automatically expanded.
- Direct relatives only: overlapping curated families do not create arbitrary transitive chains.
- No more than six suggestions are shown. Each count is a *result-row* count, not a number of unique lessons or word occurrences. A passage containing two relatives can count once in each separate search.
- New vocabulary requires publishing and indexing actual teaching text. Don't invent teaching material solely to produce suggestions.

## Verification

`node --experimental-strip-types scripts/test-search-match.mjs` checks literal matching, highlighting, irregular plurals, adjective forms, derivatives, absent words, unrelated look-alikes and prefix behavior. Build and page smoke tests run in GitHub Actions. Verify desktop/mobile in the development preview before merging to production.
