/**
 * Server-side word-form discovery for the public teaching library.
 *
 * Exact/phrase search and client highlighting stay in search-match.ts.
 * This file deliberately runs only from app/search/page.tsx; the lemmatizer
 * and WordNet-derived lexicon must not inflate the browser transcript bundle.
 *
 * Grammatical forms come from the MIT-licensed wink-lemmatizer (WordNet
 * exceptions and verified base forms). Close derivations not covered by
 * lemmatization are connected through an intentionally conservative list.
 * This is not a thesaurus or an AI/semantic similarity service.
 */
import lemmatize from 'wink-lemmatizer'

export type WordSuggestion = { word: string; kind: 'related' | 'prefix' }

const englishWord = /^[a-z]{4,40}$/

/**
 * Cross-part-of-speech derivatives, common irregular sets and British/
 * American variants. Avoid synonyms and distant thematic associations.
 * Inflections are handled generically by the lemmatizer instead of
 * enumerating each noun plural, verb tense or adjective comparison.
 */
const closeWordFamilies: readonly (readonly string[])[] = [
  ['karma', 'karmic', 'karmically'],
  ['rejoice', 'rejoicing', 'rejoiced', 'rejoices'],
  ['compassion', 'compassionate', 'compassionately'],
  ['meditate', 'meditation', 'meditations', 'meditative', 'meditator', 'meditators'],
  ['mind', 'mindful', 'mindfully', 'mindfulness'],
  ['practice', 'practise', 'practices', 'practicing', 'practising', 'practitioner', 'practitioners'],
  ['virtue', 'virtuous', 'virtuously', 'virtues'],
  ['generous', 'generosity', 'generously'],
  ['liberate', 'liberation', 'liberating', 'liberated'],
  ['suffer', 'suffering', 'sufferer', 'sufferers'],
  ['study', 'studies', 'studied', 'studying', 'student', 'students'],
  ['happy', 'happiness', 'happily', 'happier', 'happiest'],
  ['wise', 'wisdom', 'wisely'],
  ['decide', 'decision', 'decisions', 'decisive', 'decisively'],
  ['create', 'creation', 'creations', 'creative', 'creatively', 'creativity', 'creator', 'creators'],
  ['forgive', 'forgiveness', 'forgiving', 'forgiven', 'forgave'],
  ['believe', 'belief', 'beliefs', 'believer', 'believers', 'believing'],
  ['know', 'knowledge', 'knowing', 'known'],
  ['understand', 'understanding', 'understood'],
  ['teach', 'teacher', 'teachers', 'teaching', 'teachings', 'taught'],
  ['learn', 'learning', 'learner', 'learners'],
  ['think', 'thought', 'thoughts', 'thinking', 'thinker', 'thinkers'],
  ['act', 'action', 'actions', 'active', 'actively', 'activity', 'activities'],
  ['reflect', 'reflection', 'reflections', 'reflective', 'reflectively'],
  ['contemplate', 'contemplation', 'contemplative'],
  ['concentrate', 'concentration', 'concentrated'],
  ['perceive', 'perception', 'perceptive'],
  ['recognize', 'recognise', 'recognition', 'recognizable', 'recognisable'],
  ['remember', 'remembrance', 'remembering'],
  ['forget', 'forgot', 'forgotten', 'forgetting', 'forgetfulness'],
  ['aware', 'awareness'],
  ['attend', 'attendance', 'attendee', 'attendees'],
  ['observe', 'observation', 'observations', 'observant', 'observer', 'observers'],
  ['explain', 'explanation', 'explanations', 'explanatory'],
  ['describe', 'description', 'descriptions', 'descriptive'],
  ['discuss', 'discussion', 'discussions'],
  ['examine', 'examination', 'examinations', 'examiner'],
  ['explore', 'exploration', 'exploratory'],
  ['discover', 'discovery', 'discoveries'],
  ['question', 'questions', 'questioning', 'questioner'],
  ['respond', 'response', 'responses', 'responsive'],
  ['answer', 'answers', 'answering'],
  ['argue', 'argument', 'arguments'],
  ['reason', 'reasoning', 'reasonable', 'reasonably'],
  ['analyze', 'analyse', 'analysis', 'analyses', 'analytical', 'analyzeable'],
  ['evaluate', 'evaluation', 'evaluations', 'evaluative'],
  ['compare', 'comparison', 'comparative', 'comparatively'],
  ['contrast', 'contrasting'],
  ['transform', 'transformation', 'transformative'],
  ['change', 'changing', 'changeable'],
  ['improve', 'improvement', 'improvements'],
  ['grow', 'growth', 'growing', 'grown'],
  ['develop', 'development', 'developing', 'developer', 'developers'],
  ['evolve', 'evolution', 'evolutionary'],
  ['exist', 'existence', 'existing'],
  ['depend', 'dependence', 'dependent', 'dependency', 'dependencies'],
  ['connect', 'connection', 'connections', 'connected', 'connective'],
  ['relate', 'relation', 'relations', 'relationship', 'relationships', 'related'],
  ['cause', 'causal', 'causality', 'causation'],
  ['effect', 'effective', 'effectively', 'effectiveness'],
  ['influence', 'influential', 'influences'],
  ['intend', 'intention', 'intentions', 'intentional', 'intentionally'],
  ['motivate', 'motivation', 'motivated', 'motivational'],
  ['inspire', 'inspiration', 'inspirational', 'inspiring'],
  ['choose', 'choice', 'choices', 'chosen', 'choosing', 'chose'],
  ['accept', 'acceptance', 'acceptable', 'accepting'],
  ['reject', 'rejection', 'rejected'],
  ['resist', 'resistance', 'resistant'],
  ['attach', 'attachment', 'attachments', 'attached'],
  ['desire', 'desires', 'desiring', 'desirable'],
  ['crave', 'craving', 'cravings'],
  ['love', 'loving', 'lovingly', 'lovable', 'lovely'],
  ['kind', 'kindness', 'kindly'],
  ['patient', 'patience', 'patiently'],
  ['angry', 'anger', 'angrily'],
  ['fear', 'fearful', 'fearfully', 'fearless', 'fearlessness'],
  ['hope', 'hopeful', 'hopefully', 'hopeless', 'hopelessness'],
  ['humble', 'humility', 'humbly'],
  ['honest', 'honesty', 'honestly'],
  ['sincere', 'sincerity', 'sincerely'],
  ['grateful', 'gratitude', 'gratefully'],
  ['thank', 'thankful', 'thankfully', 'thankfulness'],
  ['respect', 'respectful', 'respectfully'],
  ['trust', 'trustworthy', 'trustworthiness', 'trusting'],
  ['faith', 'faithful', 'faithfully', 'faithfulness'],
  ['religion', 'religious', 'religiously'],
  ['philosophy', 'philosophical', 'philosopher', 'philosophers'],
  ['psychology', 'psychological', 'psychologist', 'psychologists'],
  ['ethics', 'ethical', 'ethically'],
  ['moral', 'morality', 'morally'],
  ['equal', 'equality', 'equally'],
  ['free', 'freedom', 'freely'],
  ['peace', 'peaceful', 'peacefully', 'peacefulness'],
  ['pure', 'purity', 'purify', 'purification'],
  ['clear', 'clarity', 'clearly'],
  ['simple', 'simplicity', 'simplify', 'simplification'],
  ['real', 'reality', 'realistic', 'realistically'],
  ['realize', 'realise', 'realization', 'realisation'],
  ['true', 'truth', 'truthful', 'truthfully'],
  ['false', 'falsehood', 'falsely'],
  ['honor', 'honour', 'honorable', 'honourable'],
  ['good', 'goodness'],
  ['bad', 'badness'],
  ['strong', 'strength', 'strengthen'],
  ['weak', 'weakness', 'weaken'],
  ['healthy', 'health', 'healthier', 'healthiest'],
  ['heal', 'healing', 'healer', 'healers'],
  ['protect', 'protection', 'protective', 'protector'],
  ['help', 'helpful', 'helpfully', 'helper', 'helpers'],
  ['support', 'supportive', 'supporter', 'supporters'],
  ['serve', 'service', 'services', 'serving'],
  ['give', 'giving', 'given', 'gave', 'giver'],
  ['share', 'sharing', 'shared'],
  ['offer', 'offering', 'offerings'],
  ['donate', 'donation', 'donations', 'donor', 'donors'],
  ['organize', 'organise', 'organization', 'organisation', 'organizational', 'organisational'],
  ['prepare', 'preparation', 'preparations', 'prepared'],
  ['complete', 'completion', 'completely'],
  ['succeed', 'success', 'successful', 'successfully'],
  ['fail', 'failure', 'failures'],
  ['difficult', 'difficulty', 'difficulties'],
  ['easy', 'easier', 'easiest', 'easily'],
  ['beauty', 'beautiful', 'beautifully'],
  ['nature', 'natural', 'naturally'],
  ['culture', 'cultural', 'culturally'],
  ['history', 'historical', 'historically', 'historian'],
  ['language', 'languages'],
  ['interpret', 'interpretation', 'interpretations', 'interpreter'],
  ['translate', 'translation', 'translations', 'translator', 'translators'],
  ['pronounce', 'pronunciation', 'pronunciations'],
  ['read', 'reading', 'reader', 'readers'],
  ['write', 'written', 'writing', 'writer', 'writers', 'wrote'],
  ['listen', 'listening', 'listener', 'listeners'],
  ['speak', 'speaking', 'speaker', 'speakers', 'spoken', 'spoke'],
  ['communicate', 'communication', 'communicative'],
  ['remember', 'reminder', 'reminders'],
]

/** Direct relationship only. Overlapping families do not merge into chains. */
const familyNeighbors = new Map<string, Set<string>>()
for (const family of closeWordFamilies) {
  for (const word of family) {
    let siblings = familyNeighbors.get(word)
    if (!siblings) { siblings = new Set<string>(); familyNeighbors.set(word, siblings) }
    for (const sibling of family) if (sibling !== word) siblings.add(sibling)
  }
}

type WordIndex = {
  words: Set<string>
  byLemma: Map<string, Set<string>>
}
const indexCache = new WeakMap<readonly string[], WordIndex>()

function lemmaKeys(word: string): [string, string, string] {
  return [
    'n:' + lemmatize.noun(word),
    'v:' + lemmatize.verb(word),
    'a:' + lemmatize.adjective(word),
  ]
}

function indexWords(vocabulary: Iterable<string>): WordIndex {
  if (Array.isArray(vocabulary)) {
    const cached = indexCache.get(vocabulary)
    if (cached) return cached
  }

  const words = new Set<string>()
  const byLemma = new Map<string, Set<string>>()
  for (const value of vocabulary) {
    const word = value.normalize('NFKC').toLocaleLowerCase()
    if (!englishWord.test(word) || words.has(word)) continue
    words.add(word)
    for (const lemma of lemmaKeys(word)) {
      let set = byLemma.get(lemma)
      if (!set) { set = new Set<string>(); byLemma.set(lemma, set) }
      set.add(word)
    }
  }

  const index = { words, byLemma }
  if (Array.isArray(vocabulary)) indexCache.set(vocabulary, index)
  return index
}

function singleEnglishWord(input: string): string | null {
  const words = input.normalize('NFKC').toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)
  if (!words || words.length !== 1 || !englishWord.test(words[0])) return null
  return words[0]
}

/**
 * Suggestions never expand the main results. A related word must be in the
 * current searchable vocabulary. Partial-prefix suggestions are considered
 * only when the exact query has no results.
 */
export function relatedWordCandidates(
  query: string,
  vocabulary: Iterable<string>,
  includePrefix = false,
  limit = 16,
): WordSuggestion[] {
  const sought = singleEnglishWord(query)
  if (!sought || limit <= 0) return []
  const index = indexWords(vocabulary)
  const candidates = new Map<string, WordSuggestion['kind']>()
  const add = (word: string, kind: WordSuggestion['kind']) => {
    if (word !== sought && index.words.has(word) && !candidates.has(word)) candidates.set(word, kind)
  }

  for (const neighbor of familyNeighbors.get(sought) ?? []) add(neighbor, 'related')
  for (const lemma of lemmaKeys(sought)) {
    for (const word of index.byLemma.get(lemma) ?? []) add(word, 'related')
  }
  if (includePrefix) {
    for (const word of index.words) {
      if (word.length > sought.length && word.startsWith(sought)) add(word, 'prefix')
    }
  }
  return [...candidates].map(([word, kind]) => ({ word, kind }))
    .sort((a, b) =>
      (a.kind === b.kind ? 0 : a.kind === 'related' ? -1 : 1) ||
      Math.abs(a.word.length - sought.length) - Math.abs(b.word.length - sought.length) ||
      a.word.localeCompare(b.word),
    )
    .slice(0, Math.min(40, Math.floor(limit)))
}
