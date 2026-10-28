import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const paths = ['lib/public-content.ts', 'lib/published-cover.ts']
const files = paths.map(path => readFileSync(new URL('../' + path, import.meta.url), 'utf8'))
const qaRef = 'qa-auto-covers-search-standalone-2026'
const temporary = files.some(source => source.includes('?ref=' + qaRef))
const isTestPR = process.env.GITHUB_EVENT_NAME === 'pull_request' &&
  process.env.GITHUB_HEAD_REF === 'qa/use-isolated-covers-index-content'
const isDevPush = process.env.GITHUB_EVENT_NAME === 'push' &&
  process.env.GITHUB_REF_NAME === 'preview-staging'

if (temporary) {
  assert.ok(isTestPR || isDevPush,
    'QA content source must NEVER be merged into a production-targeting pull request')
  for (const [i,source] of files.entries()) assert.ok(source.includes('?ref=' + qaRef),
    'Both private source readers must use the same isolated fixture branch: ' + paths[i])
  console.log('TEMP QA branch allowed only for isolated PR or preview-staging push.')
} else {
  for (const [i,source] of files.entries()) assert.ok(source.includes('?ref=main'),
    'Only approved private main content is allowed in release: '+paths[i])
  console.log('Approved Library source verified.')
}
assert.ok(!files.some(source => source.includes('qa-disposable-offering-2026-10-28')),
  'Old disposable QA source is forbidden.')
