/**
 * add-jlpt.mjs — Patch words.json with accurate JLPT level data from Jisho.
 *
 * Fetches all N5→N1 vocabulary from Jisho's tag search (paginated),
 * then patches public/dict/words.json in-place with accurate JLPT levels.
 *
 * Usage: node scripts/add-jlpt.mjs
 * Only needs to be run once (or after rebuilding words.json).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = join(__dir, '..')
const OUT   = join(ROOT, 'public', 'dict', 'words.json')

if (!existsSync(OUT)) {
  console.error('❌  public/dict/words.json not found. Run build-dict.mjs first.')
  process.exit(1)
}

const DELAY_MS = 600  // conservative rate limit

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchPage(level, page) {
  const url = `https://jisho.org/api/v1/search/words?keyword=%23jlpt-${level}&page=${page}`
  const res = await fetch(url, { headers: { 'User-Agent': 'dokkai-dict-builder' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

console.log('\n🔖  Building accurate JLPT map from Jisho\n')

const jlptMap = new Map()  // word-form → "N5"|"N4"|...

// Process N1→N5 so that N5 (most basic) always wins when a word appears in multiple levels
for (const level of ['n1', 'n2', 'n3', 'n4', 'n5']) {
  const LEVEL = level.toUpperCase()
  process.stdout.write(`  ${LEVEL}: page `)
  let page = 1
  let total = 0

  while (true) {
    process.stdout.write(`${page} `)
    let data
    try {
      data = await fetchPage(level, page)
    } catch (e) {
      process.stdout.write(`[err: ${e.message}] `)
      await sleep(2000)
      continue
    }

    const words = data.data ?? []
    if (words.length === 0) break

    for (const entry of words) {
      for (const j of entry.japanese ?? []) {
        // Use the search level (not entry.jlpt[0]) — a word appearing in #jlpt-n5
        // search IS an N5 word even if it also has N1 tags (e.g. 行く = both N1 and N5)
        if (j.word)    jlptMap.set(j.word, LEVEL)
        if (j.reading) jlptMap.set(j.reading, LEVEL)
      }
      total++
    }

    if (words.length < 20) break  // last page
    page++
    await sleep(DELAY_MS)
  }

  console.log(`→ ${total} entries`)
}

console.log(`\n  Total JLPT forms collected: ${jlptMap.size}`)

// ── Patch words.json ──────────────────────────────────────────────────────
console.log('  Patching words.json...')
const words = JSON.parse(readFileSync(OUT, 'utf8'))
let patched = 0

// First pass: set directly on non-alias entries
for (const [key, entry] of Object.entries(words)) {
  if ('_a' in entry) continue
  const jlpt = jlptMap.get(key) ?? (entry.r ? jlptMap.get(entry.r) : undefined)
  if (jlpt) {
    entry.jlpt = jlpt
    patched++
  } else {
    delete entry.jlpt  // remove stale data from old Bluskyo run
  }
}

// Second pass: propagate through aliases
for (const [, entry] of Object.entries(words)) {
  if (!('_a' in entry)) continue
  const target = words[entry._a]
  if (target && !('_a' in target) && target.jlpt) {
    entry._jlpt = target.jlpt  // store on alias for quick lookup
  }
}

writeFileSync(OUT, JSON.stringify(words))
console.log(`  Patched ${patched} entries`)
console.log(`\n✅  Done! Commit public/dict/words.json to deploy.\n`)
