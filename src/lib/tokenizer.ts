/**
 * Japanese tokenizer using kuromoji.
 * Wraps the async initialization so callers get a simple tokenize() function.
 * Dictionary files are loaded from /kuromoji-dict/ (copied to public/).
 */

import kuromoji from 'kuromoji'
import type { IpadicFeatures, Tokenizer } from 'kuromoji'
import { lookupWordAsync } from './dict'

export type Token = {
  word: string
  reading: string
  pos: string
  meaning: string
  pitch: number
  jlpt: string
}

let tokenizerInstance: Tokenizer<IpadicFeatures> | null = null
let initPromise: Promise<void> | null = null

function initTokenizer(): Promise<void> {
  if (tokenizerInstance) return Promise.resolve()
  if (initPromise) return initPromise
  initPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: '/kuromoji-dict' }).build((err, tokenizer) => {
      if (err) { reject(err); return }
      tokenizerInstance = tokenizer
      resolve()
    })
  })
  return initPromise
}

// IPAdic POS → simple label
const POS_MAP: Record<string, string> = {
  '名詞': 'noun', '動詞': 'verb', '形容詞': 'adjective', '形容動詞': 'adjective',
  '副詞': 'adverb', '助詞': 'particle', '助動詞': 'auxiliary', '接続詞': 'conjunction',
  '感動詞': 'interjection', '接頭詞': 'prefix', '接尾辞': 'suffix', '記号': 'symbol',
}

const POS_MAP_ZH: Record<string, string> = {
  '名詞': '名词', '動詞': '动词', '形容詞': '形容词', '形容動詞': '形容动词',
  '副詞': '副词', '助詞': '助词', '助動詞': '助动词', '接続詞': '连词',
  '感動詞': '感叹词', '接頭詞': '前缀', '接尾辞': '后缀', '記号': '符号',
}

// Only these IPAdic POS categories are shown in the word list
const KEEP_POS = new Set(['名詞', '動詞', '形容詞', '形容動詞', '副詞'])

export async function tokenizeSentence(sentence: string, language: 'zh' | 'en'): Promise<Token[]> {
  await initTokenizer()
  const raw = tokenizerInstance!.tokenize(sentence)

  const tokens: Token[] = []
  const seen = new Set<string>()

  for (let i = 0; i < raw.length; i++) {
    const t = raw[i]
    const pos1 = t.pos               // e.g. 名詞
    const surface = t.surface_form   // as it appears in text

    // Only keep content words; skip particles, auxiliaries, conjunctions, etc.
    if (!KEEP_POS.has(pos1)) continue

    // Use base form (dictionary form) for lookup
    let base = t.basic_form && t.basic_form !== '*' ? t.basic_form : surface

    // Combine サ変 nouns with a following する verb → e.g. 撮影する, 勉強する
    // Handles all forms: する・した・します・される・させる etc.
    if (pos1 === '名詞' && t.pos_detail_1 === 'サ変接続') {
      const next = raw[i + 1]
      if (next && next.pos === '動詞' && next.basic_form === 'する') {
        base = base + 'する'
        i++ // consume the する token
      }
    }
    if (seen.has(base)) continue
    seen.add(base)

    // Reading from kuromoji (katakana), convert to hiragana
    const readingKata = t.reading && t.reading !== '*' ? t.reading : surface
    const reading = readingKata.replace(/[\u30a1-\u30f6]/g, c =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    )

    const posLabel = language === 'en'
      ? (POS_MAP[pos1] ?? pos1)
      : (POS_MAP_ZH[pos1] ?? pos1)

    // Look up meaning + pitch + jlpt from local dict
    const entry = await lookupWordAsync(base, reading)
    const meaning = entry
      ? (language === 'en' ? entry.en?.[0] : entry.zh?.[0]) ?? entry.en?.[0] ?? ''
      : ''
    const pitch = entry?.p ?? 0
    const jlpt = entry?.jlpt ?? ''

    tokens.push({ word: base, reading, pos: posLabel, meaning, pitch, jlpt })
  }

  return tokens
}
