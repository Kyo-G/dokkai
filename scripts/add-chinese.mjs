/**
 * add-chinese.mjs — Batch-generate Chinese meanings for JLPT words in words.json.
 *
 * Uses the Claude API (claude-haiku-4-5) to translate Japanese dictionary entries.
 * Processes N5→N1 words in batches of 30, saving progress after each batch.
 *
 * Usage (set whichever key you have):
 *   ANTHROPIC_API_KEY=sk-ant-...   node scripts/add-chinese.mjs
 *   OPENAI_API_KEY=sk-...          node scripts/add-chinese.mjs
 *   GEMINI_API_KEY=AIza...         node scripts/add-chinese.mjs
 *   DEEPSEEK_API_KEY=sk-...        node scripts/add-chinese.mjs
 *
 * Optional env vars:
 *   JLPT_LEVELS   — comma-separated levels to process, e.g. "N5,N4,N3" (default: all)
 *   BATCH_SIZE    — words per API call (default: 30)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = join(__dir, '..')
const OUT   = join(ROOT, 'public', 'dict', 'words.json')

const LEVELS     = (process.env.JLPT_LEVELS ?? 'N5,N4,N3,N2,N1').split(',').map(s => s.trim())
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '30')
const DELAY_MS   = 300

// Auto-detect provider from environment
let PROVIDER, API_KEY
if (process.env.ANTHROPIC_API_KEY)  { PROVIDER = 'claude';   API_KEY = process.env.ANTHROPIC_API_KEY }
else if (process.env.OPENAI_API_KEY)  { PROVIDER = 'openai';   API_KEY = process.env.OPENAI_API_KEY }
else if (process.env.GEMINI_API_KEY)  { PROVIDER = 'gemini';   API_KEY = process.env.GEMINI_API_KEY }
else if (process.env.DEEPSEEK_API_KEY){ PROVIDER = 'deepseek'; API_KEY = process.env.DEEPSEEK_API_KEY }
else {
  console.error('❌  Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY')
  process.exit(1)
}

if (!existsSync(OUT)) {
  console.error('❌  public/dict/words.json not found. Run build-dict.mjs first.')
  process.exit(1)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function callAI(prompt) {
  let res, data
  if (PROVIDER === 'claude') {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) throw new Error(`Claude HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    data = await res.json()
    return data.content[0].text
  }
  if (PROVIDER === 'openai' || PROVIDER === 'deepseek') {
    const url = PROVIDER === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/v1/chat/completions'
    const model = PROVIDER === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat'
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) throw new Error(`${PROVIDER} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    data = await res.json()
    return data.choices[0].message.content
  }
  if (PROVIDER === 'gemini') {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048 } }),
    })
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    data = await res.json()
    return data.candidates[0].content.parts[0].text
  }
  throw new Error('Unknown provider')
}

/**
 * Given a batch of {key, reading, en} objects, returns a map of key → zh[].
 * Retries once on parse failure.
 */
async function translateBatch(batch, attempt = 1) {
  const lines = batch.map(w => {
    const en = w.en?.slice(0, 2).join('；') ?? ''
    const reading = w.reading !== w.key ? `（${w.reading}）` : ''
    return `${w.key}${reading}: ${en}`
  }).join('\n')

  const prompt =
    `你是一本日中词典的编辑。下面是一批日语词汇，每行格式为「词语（假名）: 英文释义」。\n` +
    `请为每个词给出1-3个简洁的中文释义（单个词语或短语，不超过6个字）。\n` +
    `严格按照以下JSON格式返回，key为日语词语，value为中文释义数组，不要输出任何其他内容：\n` +
    `{"词语1": ["释义1", "释义2"], "词语2": ["释义1"], ...}\n\n` +
    lines

  let text
  try {
    text = await callAI(prompt)
  } catch (e) {
    if (attempt < 3) { await sleep(2000); return translateBatch(batch, attempt + 1) }
    throw e
  }

  // Extract JSON block
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    if (attempt < 3) { await sleep(1000); return translateBatch(batch, attempt + 1) }
    console.warn('  ⚠️  No JSON in response, skipping batch')
    return {}
  }

  try {
    return JSON.parse(match[0])
  } catch {
    if (attempt < 3) { await sleep(1000); return translateBatch(batch, attempt + 1) }
    console.warn('  ⚠️  JSON parse failed, skipping batch')
    return {}
  }
}

console.log('\n🈶  Adding Chinese meanings to words.json\n')
console.log(`  Provider: ${PROVIDER}`)
console.log(`  Levels: ${LEVELS.join(', ')}`)
console.log(`  Batch size: ${BATCH_SIZE}`)
console.log()

const words = JSON.parse(readFileSync(OUT, 'utf8'))

// Collect target entries: JLPT words without zh, grouped by level
const targets = {}
for (const level of LEVELS) targets[level] = []

for (const [key, entry] of Object.entries(words)) {
  if ('_a' in entry) continue
  if (!entry.jlpt || !LEVELS.includes(entry.jlpt)) continue
  if (entry.zh && entry.zh.length > 0) continue  // already has Chinese
  targets[entry.jlpt].push({ key, reading: entry.r, en: entry.en })
}

const totalWords = Object.values(targets).reduce((a, b) => a + b.length, 0)
console.log(`  Words to translate: ${totalWords}`)
Object.entries(targets).forEach(([lvl, arr]) => console.log(`    ${lvl}: ${arr.length}`))
console.log()

let totalPatched = 0
let batchNum = 0

for (const level of LEVELS) {
  const list = targets[level]
  if (list.length === 0) { console.log(`  ${level}: nothing to do\n`); continue }

  const batches = Math.ceil(list.length / BATCH_SIZE)
  console.log(`  ${level}: ${list.length} words → ${batches} batches`)

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    batchNum++
    const batch = list.slice(i, i + BATCH_SIZE)
    const batchIdx = Math.floor(i / BATCH_SIZE) + 1

    process.stdout.write(`    batch ${batchIdx}/${batches} (${batch[0].key}…) `)

    let result = {}
    try {
      result = await translateBatch(batch)
    } catch (e) {
      process.stdout.write(`[err: ${e.message.slice(0, 60)}]\n`)
      continue
    }

    let batchPatched = 0
    for (const item of batch) {
      const zh = result[item.key]
      if (Array.isArray(zh) && zh.length > 0) {
        words[item.key].zh = zh
        batchPatched++
        totalPatched++
      }
    }
    process.stdout.write(`✓ ${batchPatched}/${batch.length}\n`)

    // Save after every batch so progress isn't lost on error
    writeFileSync(OUT, JSON.stringify(words))

    if (i + BATCH_SIZE < list.length) await sleep(DELAY_MS)
  }
  console.log()
}

writeFileSync(OUT, JSON.stringify(words))
console.log(`✅  Done! Patched ${totalPatched} entries with Chinese meanings.`)
console.log('   Commit public/dict/words.json to deploy.\n')
