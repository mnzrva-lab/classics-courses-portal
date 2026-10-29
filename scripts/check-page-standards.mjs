import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const cwd = process.cwd()
const registry = JSON.parse(readFileSync(path.join(cwd, 'docs/page-standards-registry.json'), 'utf8'))
const errors = []

function read(relative) {
  return readFileSync(path.join(cwd, relative), 'utf8')
}
function walk(directory) {
  const full = path.join(cwd, directory)
  if (!existsSync(full)) return []
  return readdirSync(full, { withFileTypes: true }).flatMap(entry => {
    const child = path.posix.join(directory, entry.name)
    return entry.isDirectory() ? walk(child) : entry.isFile() && entry.name === 'page.tsx' ? [child] : []
  })
}
function fail(message) { errors.push(message) }
function has(relative, text, hint) {
  if (!read(relative).includes(text)) fail(relative + ': missing ' + hint)
}

assert.equal(registry.schemaVersion, 1)
const found = new Set(registry.publicPageRoots.flatMap(walk))
const registered = new Set(Object.keys(registry.roles))
for (const f of found) if (!registered.has(f)) fail('Unregistered public page: ' + f + '. Choose a role in docs/page-standards-registry.json.')
for (const f of registered) if (!found.has(f)) fail('Registry references missing page: ' + f)

const validRoles = new Set(['index','course','class','delegate-course','delegate-class','legacy-exception','special-exception'])
for (const [file, role] of Object.entries(registry.roles)) {
  if (!found.has(file)) continue
  if (!validRoles.has(role)) { fail(file + ': unknown role: ' + role); continue }
  const source = read(file)
  if (role === 'course') {
    if (!source.includes("from '@/components/library-course-hero'") || !source.includes('<LibraryCourseHero')) fail(file + ': use LibraryCourseHero instead of another hero.')
    if (!source.includes('offering-breadcrumbs')) fail(file + ': course needs linked breadcrumbs before the hero.')
  } else if (role === 'class') {
    if (!source.includes("from '@/components/library-class-header'") || !source.includes('<LibraryClassHeader')) fail(file + ': missing LibraryClassHeader.')
    if (!source.includes("from '@/components/library-class-section'") || !source.includes('<LibraryClassSection')) fail(file + ': missing LibraryClassSection.')
    if (!source.includes('id="recording"')) fail(file + ': missing #recording anchor.')
    if (!source.includes('id="transcript"')) fail(file + ': missing #transcript anchor.')
    if (!source.includes('<ClassSequenceNavigation')) fail(file + ': missing ClassSequenceNavigation.')
    if (!source.includes('offering-breadcrumbs')) fail(file + ': missing breadcrumbs.')
  } else if (role === 'delegate-course') {
    if (!source.includes('ClassicsCourseHub')) fail(file + ': delegate must point to ClassicsCourseHub.')
  } else if (role === 'delegate-class') {
    if (!source.includes('EyeOfCourageClassPage')) fail(file + ': delegate must point to EyeOfCourageClassPage.')
  } else if (role.endsWith('-exception')) {
    const reason = registry.exceptions?.[file]
    if (typeof reason !== 'string' || reason.trim().length < 40) fail(file + ': exception requires a meaningful explanation.')
  }
}
for (const file of Object.keys(registry.exceptions ?? {})) {
  if (!registry.roles[file]?.endsWith('-exception')) fail('Reason for non-exception page: ' + file)
}
has('components/classics-course-hub.tsx', '<LibraryCourseHero', 'shared ClassicsCourseHub course hero')
has('components/eye-of-courage-class-page.tsx', '<LibraryClassHeader', 'shared Eye of Courage class header')
has('components/eye-of-courage-class-page.tsx', '<LibraryClassSection id="recording"', 'shared Eye of Courage recording section')
has('components/library-course-hero.tsx', 'data-layout-standard="course-hero-v1"', 'course hero contract marker')
has('components/library-course-hero.tsx', 'alt={artwork.alt}', 'required image alt')
has('components/library-class-header.tsx', 'data-layout-standard="class-v1"', 'class heading contract marker')
has('app/layout.tsx', "import './library-page-standards.css'", 'shared public page stylesheet')
has('app/library-page-standards.css', '@media (max-width: 820px)', 'mobile split-to-stack breakpoint')
has('app/library-page-standards.css', 'grid-template-columns: minmax(0, 42%) minmax(0, 58%)', 'approved split ratio')
if (!existsSync(path.join(cwd, 'public/images/living-lam-rim/term-7/BG.webp'))) fail('Missing original Term 7 cover image.')
if (errors.length) {
  console.error('Page-design standards failed:\n- ' + errors.join('\n- '))
  process.exitCode = 1
} else {
  console.log('Page design standards passed: ' + found.size + ' public pages checked; ' + Object.values(registry.roles).filter(v => v.endsWith('-exception')).length + ' documented exceptions.')
}
