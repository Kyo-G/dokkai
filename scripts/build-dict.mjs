/**
 * build-dict.mjs — One-time script to build the local Japanese dictionary.
 *
 * Sources:
 *  - JMdict-simplified (GitHub releases) — word meanings in Chinese + English
 *  - Kanjium (GitHub raw)                — pitch accent data
 *  - Tatoeba (downloads.tatoeba.org)     — Japanese-Chinese example sentences
 *
 * Output: public/dict/words.json
 *
 * Usage: node scripts/build-dict.mjs
 * Requires: bunzip2 (macOS/Linux built-in)
 */

import { writeFileSync, mkdirSync, existsSync, writeSync, openSync, closeSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT   = join(__dir, '..')
const OUT    = join(ROOT, 'public', 'dict', 'words.json')

if (!existsSync(join(ROOT, 'public', 'dict'))) {
  mkdirSync(join(ROOT, 'public', 'dict'), { recursive: true })
}

// ── POS mapping (JMdict codes → Chinese labels) ────────────────────────
const POS_MAP = {
  v1: '一段动词', v5r: '五段动词', v5k: '五段动词', v5s: '五段动词',
  v5t: '五段动词', v5n: '五段动词', v5m: '五段动词', v5b: '五段动词',
  v5g: '五段动词', v5u: '五段动词', v5uru: '五段动词', 'v5r-i': '五段动词',
  'vs-i': 'サ变动词', 'vs-s': 'サ变动词', vk: 'カ变动词',
  'adj-i': 'い形容词', 'adj-na': 'な形容词', 'adj-no': 'の形容词',
  'adj-t': '形容词', 'adj-pn': '连体词',
  n: '名词', 'n-suf': '名词（后缀）', 'n-pref': '名词（前缀）', 'n-t': '名词',
  adv: '副词', 'adv-to': '副词', conj: '接续词', prt: '助词',
  int: '感叹词', pn: '代词', num: '数词',
  exp: '惯用表达', pref: '前缀', suf: '后缀', unc: '词',
}

function posLabel(codes) {
  for (const code of codes) {
    if (POS_MAP[code]) return POS_MAP[code]
  }
  return codes[0] || '词'
}

// ── Helpers ────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  process.stdout.write(`  GET ${url.slice(0, 80)}...\n`)
  const res = await fetch(url, { headers: { 'User-Agent': 'dokkai-dict-builder' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.json()
}

async function fetchText(url) {
  process.stdout.write(`  GET ${url.slice(0, 80)}...\n`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

async function fetchBz2Text(url) {
  process.stdout.write(`  GET (bz2) ${url.slice(0, 70)}...\n`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const tmpFile = '/tmp/_dokkai_dl.bz2'
  writeFileSync(tmpFile, buf)
  return execSync(`bunzip2 -c ${tmpFile}`, { maxBuffer: 300 * 1024 * 1024 }).toString()
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📚 Building Dokkai local dictionary\n')

  // ── 1. JMdict-simplified ───────────────────────────────────────────
  console.log('Step 1/4: JMdict-simplified (word meanings + readings)')
  const release = await fetchJSON(
    'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest'
  )
  // Try language-specific zh file first, then all-languages file
  let asset = release.assets.find(a => /jmdict-(zh|zho|cmn|all).*\.json$/.test(a.name))
  if (!asset) {
    console.log('  Available assets:', release.assets.map(a => a.name).join(', '))
    throw new Error('Cannot find a suitable JMdict asset. Check the GitHub releases page.')
  }
  console.log(`  Using: ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)} MB)`)
  const jmdict = await fetchJSON(asset.browser_download_url)
  console.log(`  Loaded ${jmdict.words.length} entries\n`)

  // ── 2. Kanjium pitch accent ────────────────────────────────────────
  console.log('Step 2/4: Kanjium pitch accent')
  const pitchCSV = await fetchText(
    'https://raw.githubusercontent.com/mifunetoshiro/kanjium/master/data/source_files/merged/kanjium_pitches.csv'
  )
  const pitchMap = new Map() // "kanji|kana" → number
  let pitchCount = 0
  for (const line of pitchCSV.split('\n')) {
    const parts = line.split(',')
    if (parts.length < 3) continue
    const [kanji, kana, rawPitch] = parts
    const pitch = parseInt(rawPitch.trim())
    if (isNaN(pitch)) continue
    pitchMap.set(`${kanji.trim()}|${kana.trim()}`, pitch)
    pitchMap.set(`${kana.trim()}|${kana.trim()}`, pitch) // kana-only key
    pitchCount++
  }
  console.log(`  Loaded ${pitchCount} pitch entries\n`)

  // ── 3. Tatoeba Japanese-Chinese sentence pairs ─────────────────────
  console.log('Step 3/4: Tatoeba Japanese-Chinese examples (may take a few minutes)')

  // Collect all JMdict word forms for fast membership check
  const jmdictWordSet = new Set()
  for (const entry of jmdict.words) {
    for (const k of entry.kanji ?? []) jmdictWordSet.add(k.text)
    for (const k of entry.kana ?? []) jmdictWordSet.add(k.text)
  }

  const tatoebaExamples = new Map() // word → [{j, c}]

  try {
    const jpnTSV   = await fetchBz2Text('https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2')
    const cmnTSV   = await fetchBz2Text('https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2')
    const linksCSV = await fetchBz2Text('https://downloads.tatoeba.org/exports/links.csv.bz2')

    // Parse sentences
    const jpnSents = new Map()
    for (const line of jpnTSV.split('\n')) {
      const tab1 = line.indexOf('\t'), tab2 = line.indexOf('\t', tab1 + 1)
      if (tab1 < 0) continue
      const id   = line.slice(0, tab1)
      const text = tab2 > 0 ? line.slice(tab2 + 1).trim() : line.slice(tab1 + 1).trim()
      if (id && text) jpnSents.set(id, text)
    }

    const cmnSents = new Map()
    for (const line of cmnTSV.split('\n')) {
      const tab1 = line.indexOf('\t'), tab2 = line.indexOf('\t', tab1 + 1)
      if (tab1 < 0) continue
      const id   = line.slice(0, tab1)
      const text = tab2 > 0 ? line.slice(tab2 + 1).trim() : line.slice(tab1 + 1).trim()
      if (id && text) cmnSents.set(id, text)
    }

    console.log(`  ${jpnSents.size} Japanese sentences, ${cmnSents.size} Chinese sentences`)

    // Build jpn_id → cmn_text map
    const jpnToCmn = new Map()
    for (const line of linksCSV.split('\n')) {
      const [id1, id2] = line.split('\t')
      if (!id1 || !id2) continue
      if (jpnSents.has(id1) && cmnSents.has(id2) && !jpnToCmn.has(id1)) {
        jpnToCmn.set(id1, cmnSents.get(id2))
      } else if (jpnSents.has(id2) && cmnSents.has(id1) && !jpnToCmn.has(id2)) {
        jpnToCmn.set(id2, cmnSents.get(id1))
      }
    }

    console.log(`  ${jpnToCmn.size} Japanese-Chinese sentence pairs`)
    console.log('  Building word→examples index (substring search)...')

    // Inverted index: for each sentence, extract substrings and map to examples
    for (const [jpnId, cmnText] of jpnToCmn) {
      const jpn = jpnSents.get(jpnId)
      if (!jpn || jpn.length > 60) continue  // skip very long sentences

      for (let start = 0; start < jpn.length; start++) {
        for (let len = 2; len <= 7; len++) {
          if (start + len > jpn.length) break
          const substr = jpn.slice(start, start + len)
          if (!jmdictWordSet.has(substr)) continue
          if (!tatoebaExamples.has(substr)) tatoebaExamples.set(substr, [])
          const arr = tatoebaExamples.get(substr)
          if (arr.length < 3) arr.push({ j: jpn, c: cmnText })
        }
      }
    }
    console.log(`  Examples found for ${tatoebaExamples.size} words\n`)
  } catch (e) {
    console.warn(`  ⚠️  Tatoeba step failed: ${e.message}`)
    console.warn('  Continuing without Tatoeba examples (you can re-run later)\n')
  }

  // ── 4. Merge into compact output ───────────────────────────────────
  console.log('Step 4/4: Processing and writing output...')
  const result = {}
  let processed = 0

  for (const entry of jmdict.words) {
    const kanjiList = (entry.kanji ?? []).map(k => k.text)
    const kanaList  = (entry.kana ?? []).map(k => k.text)
    const primaryKana = kanaList[0]
    if (!primaryKana) continue

    // Collect meanings
    const zhMeanings = []
    const enMeanings = []
    const posCodes   = []

    for (const sense of entry.sense ?? []) {
      for (const g of sense.gloss ?? []) {
        const lang = g.lang?.toLowerCase()
        if ((lang === 'zho' || lang === 'zh') && zhMeanings.length < 4) zhMeanings.push(g.text)
        if (lang === 'eng' && enMeanings.length < 3) enMeanings.push(g.text)
      }
      if (posCodes.length === 0) posCodes.push(...(sense.partOfSpeech ?? []))
    }

    if (zhMeanings.length === 0 && enMeanings.length === 0) continue

    const primaryKanji = kanjiList[0]
    const lookupKey    = primaryKanji ?? primaryKana

    // Pitch lookup
    const pitchKey = primaryKanji
      ? `${primaryKanji}|${primaryKana}`
      : `${primaryKana}|${primaryKana}`
    const pitch = pitchMap.get(pitchKey) ?? pitchMap.get(`${primaryKana}|${primaryKana}`)

    // Examples
    const examples = tatoebaExamples.get(lookupKey)
      ?? tatoebaExamples.get(primaryKana)
      ?? []

    const dictEntry = {
      r: primaryKana,
      pos: posLabel(posCodes),
      ...(zhMeanings.length > 0 ? { zh: zhMeanings } : {}),
      ...(enMeanings.length > 0 ? { en: enMeanings } : {}),
      ...(pitch !== undefined ? { p: pitch } : {}),
      ...(examples.length > 0 ? { ex: examples.slice(0, 3) } : {}),
    }

    // Index by kanji form(s)
    for (const kanji of kanjiList) {
      if (!result[kanji]) result[kanji] = dictEntry
    }

    // Index by kana (alias pointing to primary kanji, or full entry if no kanji)
    for (const kana of kanaList) {
      if (!result[kana]) {
        result[kana] = primaryKanji ? { _a: primaryKanji } : dictEntry
      }
    }

    processed++
  }

  const json = JSON.stringify(result)
  writeFileSync(OUT, json)

  const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1)
  console.log(`\n✅ Done!`)
  console.log(`   Entries processed: ${processed}`)
  console.log(`   Index keys:        ${Object.keys(result).length}`)
  console.log(`   Output size:       ${sizeMB} MB`)
  console.log(`   Output path:       ${OUT}`)
  console.log('\nCommit public/dict/words.json to deploy the dictionary.')
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1) })
