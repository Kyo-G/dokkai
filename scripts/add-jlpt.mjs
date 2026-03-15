/**
 * add-jlpt.mjs — Patch words.json with JLPT level data.
 *
 * Source: Bluskyo/JLPT_Vocabulary (community-compiled N1–N5 word list)
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

console.log('\n🔖  Adding JLPT level data to words.json\n')

// ── 1. Fetch JLPT word list ───────────────────────────────────────────────
console.log('Step 1/2: Fetching JLPT vocabulary list...')
const url = 'https://raw.githubusercontent.com/Bluskyo/JLPT_Vocabulary/main/data/results/JLPTWords.json'
const res = await fetch(url, { headers: { 'User-Agent': 'dokkai-jlpt-patcher' } })
if (!res.ok) throw new Error(`HTTP ${res.status} fetching JLPT word list`)

// Format: { "word": "N1" | "N2" | ... }
const jlptMap = await res.json()
console.log(`  Loaded ${Object.keys(jlptMap).length} JLPT entries`)

// ── 2. Patch words.json ───────────────────────────────────────────────────
console.log('Step 2/2: Patching words.json...')
const words = JSON.parse(readFileSync(OUT, 'utf8'))
let patched = 0

for (const [key, entry] of Object.entries(words)) {
  if ('_a' in entry) continue  // skip aliases
  const jlpt = jlptMap[key] ?? (entry.r ? jlptMap[entry.r] : undefined)
  if (jlpt && !entry.jlpt) {
    entry.jlpt = jlpt
    patched++
  }
}

writeFileSync(OUT, JSON.stringify(words))
console.log(`  Patched ${patched} entries with JLPT data`)
console.log(`\n✅  Done! Commit public/dict/words.json to deploy.\n`)
