import type { Settings, SentenceAnalysis, WordDetails, GrammarDetails } from '../types'
import { tokenizeSentence } from './tokenizer'

// ──────────────────────────────────────────────
// Prompt builders
// ──────────────────────────────────────────────

function buildSentenceAnalysisPrompt(sentence: string, language: 'zh' | 'en'): string {
  if (language === 'en') {
    return `Analyze this Japanese sentence. Return JSON only, no other text.
「${sentence}」
{"structure":[{"text":"segment","role":"Subject/Predicate/Object/Modifier/Complement/Conjunction"}],"grammar":[{"pattern":"","meaning":"","usage":"","jlpt":"N3"}],"words":[{"word":"","reading":"","pos":"noun/verb/adjective/adverb/particle/auxiliary/conjunction/prefix/suffix","meaning":"concise English meaning"}]}
- structure: cover full sentence
- grammar: noteworthy grammar patterns only (e.g. てしまう、に対して), may be []
- words: vocabulary worth learning (skip particles, punctuation, and very basic words like です/は/が/を/に)`
  }

  return `分析以下日语句子，只返回JSON，不要其他文字。
「${sentence}」
{"structure":[{"text":"片段","role":"主语/谓语/宾语/修饰成分/补语/连词"}],"grammar":[{"pattern":"","meaning":"","usage":"","jlpt":"N3"}],"words":[{"word":"","reading":"","pos":"名词/动词/形容词/副词/助词/助动词/连词/前缀/后缀","meaning":"简洁中文释义"}]}
- structure：覆盖全句
- grammar：值得学的语法点（如てしまう、に対して），可为[]
- words：值得学习的词汇（跳过助词、标点和极基础词如です/は/が/を/に）`
}

// ──────────────────────────────────────────────
// Client-side furigana generation
// Uses the words returned by AI analysis to annotate kanji in the sentence
// ──────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function generateFurigana(sentence: string, words: Array<{ word: string; reading: string }>): string {
  // Only annotate words that contain kanji, longest first to avoid partial matches
  const kanjiWords = words
    .filter(w => /[\u4e00-\u9fff]/.test(w.word))
    .sort((a, b) => b.word.length - a.word.length)

  // Process as segments: only replace within unannotated parts
  type Seg = { text: string; done: boolean }
  let segs: Seg[] = [{ text: sentence, done: false }]

  for (const w of kanjiWords) {
    const re = new RegExp(escapeRegex(w.word), 'g')
    const next: Seg[] = []
    for (const seg of segs) {
      if (seg.done) { next.push(seg); continue }
      const parts = seg.text.split(re)
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) next.push({ text: parts[i], done: false })
        if (i < parts.length - 1) next.push({ text: `{${w.word}|${w.reading}}`, done: true })
      }
    }
    segs = next
  }

  return segs.map(s => s.text).join('')
}

function buildWordDetailsPrompt(word: string, reading: string, pos: string, language: 'zh' | 'en'): string {
  if (language === 'en') {
    return `You are a professional Japanese language teacher. Explain the following Japanese word in detail in English, and return a strict JSON format.

Word: ${word}（${reading}）[${pos}]

Return the following JSON structure (no extra text, JSON only):
{
  "word": "${word}",
  "reading": "${reading}",
  "pos": "${pos}",
  "pitch": 0,
  "meaning": "complete English meaning",
  "usage": "usage notes including common collocations and important points",
  "examples": [
    {
      "japanese": "example sentence with furigana {漢字|よみ} on kanji",
      "translation": "English translation"
    },
    {
      "japanese": "example sentence 2 with furigana {漢字|よみ} on kanji",
      "translation": "English translation 2"
    },
    {
      "japanese": "example sentence 3 with furigana {漢字|よみ} on kanji",
      "translation": "English translation 3"
    }
  ]
}

Note: in the japanese field, only annotate characters that are kanji in the original using {漢字|よみ}; leave hiragana, katakana and punctuation unchanged. Never convert kana words to kanji just to annotate them.`
  }

  return `你是一位专业的日语教师，请详细解释以下日语单词，用中文，返回严格的JSON格式。

单词：${word}（${reading}）[${pos}]

请返回如下JSON结构（不要有任何多余的文字，只返回JSON）：
{
  "word": "${word}",
  "reading": "${reading}",
  "pos": "${pos}",
  "pitch": 0,
  "meaning": "完整的中文释义",
  "usage": "用法说明，包括常见搭配和注意事项",
  "examples": [
    {
      "japanese": "日语例句，对汉字用{漢字|よみ}标注振假名",
      "translation": "中文翻译"
    },
    {
      "japanese": "日语例句2，对汉字用{漢字|よみ}标注振假名",
      "translation": "中文翻译2"
    },
    {
      "japanese": "日语例句3，对汉字用{漢字|よみ}标注振假名",
      "translation": "中文翻译3"
    }
  ]
}

注意：examples 中的 japanese 字段，只对原文本身是汉字的词标注{漢字|よみ}，平假名/片假名/符号原样保留，禁止把假名词改写成汉字再标注。`
}

function buildGrammarDetailsPrompt(pattern: string, meaning: string, language: 'zh' | 'en'): string {
  if (language === 'en') {
    return `You are a professional Japanese language teacher. Explain the following Japanese grammar point in detail in English, and return a strict JSON format.

Grammar: ${pattern}（${meaning}）

Return the following JSON structure (no extra text, JSON only):
{
  "pattern": "${pattern}",
  "meaning": "${meaning}",
  "usage": "detailed usage explanation including conjugation rules and important notes",
  "nuance": "nuance and tone notes; differences from similar grammar patterns",
  "examples": [
    {"japanese": "example 1 with {漢字|よみ} furigana on kanji", "translation": "English translation 1"},
    {"japanese": "example 2 with {漢字|よみ} furigana on kanji", "translation": "English translation 2"},
    {"japanese": "example 3 with {漢字|よみ} furigana on kanji", "translation": "English translation 3"}
  ]
}

Note: in the japanese field, only annotate characters that are kanji in the original using {漢字|よみ}; leave hiragana, katakana and punctuation unchanged. Never convert kana words to kanji just to annotate them.`
  }

  return `你是一位专业的日语教师，请详细讲解以下日语语法点，用中文，返回严格的JSON格式。

语法：${pattern}（${meaning}）

请返回如下JSON结构（不要有任何多余的文字，只返回JSON）：
{
  "pattern": "${pattern}",
  "meaning": "${meaning}",
  "usage": "详细的用法说明，包括接续方式和注意事项",
  "nuance": "语感/语气说明，与近似语法的区别",
  "examples": [
    {"japanese": "例句1，对汉字用{漢字|よみ}标注振假名", "translation": "中文翻译1"},
    {"japanese": "例句2，对汉字用{漢字|よみ}标注振假名", "translation": "中文翻译2"},
    {"japanese": "例句3，对汉字用{漢字|よみ}标注振假名", "translation": "中文翻译3"}
  ]
}

注意：examples 中的 japanese 字段，只对原文本身是汉字的词标注{漢字|よみ}，平假名/片假名/符号原样保留，禁止把假名词改写成汉字再标注。`
}

function buildTestPrompt(language: 'zh' | 'en'): string {
  return language === 'en'
    ? 'Answer in English: what is 1+1? Reply with the number only.'
    : '请用中文回答：1+1等于几？只回答数字即可。'
}

// ──────────────────────────────────────────────
// JSON extractor
// ──────────────────────────────────────────────

function extractJSON(text: string): unknown {
  // Try to find JSON block
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
    text.match(/```\s*([\s\S]*?)```/) ||
    text.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text
  return JSON.parse(jsonStr.trim())
}

// ──────────────────────────────────────────────
// Provider implementations
// ──────────────────────────────────────────────

async function callClaude(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || `Claude API error: ${response.status}`)
  }
  const data = await response.json() as { content: Array<{ text: string }> }
  return data.content[0].text
}

async function callOpenAI(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || `OpenAI API error: ${response.status}`)
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

async function callDeepSeek(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || `DeepSeek API error: ${response.status}`)
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

async function callGemini(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || `Gemini API error: ${response.status}`)
  }
  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  return data.candidates[0].content.parts[0].text
}

// ──────────────────────────────────────────────
// Unified AI caller
// ──────────────────────────────────────────────

// Each Japanese character in the sentence roughly produces ~15 output tokens
// (structure segment + word entry + grammar entry). Clamp between 512 and 2048.
function estimateMaxTokens(sentence: string): number {
  return Math.min(2048, Math.max(512, 400 + sentence.length * 15))
}

async function callAI(settings: Settings, prompt: string, maxTokens = 1536): Promise<string> {
  const { provider, claudeKey, openaiKey, geminiKey, deepseekKey, language } = settings
  const isEn = language === 'en'
  switch (provider) {
    case 'claude':
      if (!claudeKey) throw new Error(isEn ? 'Please enter your Claude API Key in Settings.' : '请先在设置页面填入 Claude API Key')
      return callClaude(claudeKey, prompt, maxTokens)
    case 'openai':
      if (!openaiKey) throw new Error(isEn ? 'Please enter your OpenAI API Key in Settings.' : '请先在设置页面填入 OpenAI API Key')
      return callOpenAI(openaiKey, prompt, maxTokens)
    case 'gemini':
      if (!geminiKey) throw new Error(isEn ? 'Please enter your Gemini API Key in Settings.' : '请先在设置页面填入 Gemini API Key')
      return callGemini(geminiKey, prompt, maxTokens)
    case 'deepseek':
      if (!deepseekKey) throw new Error(isEn ? 'Please enter your DeepSeek API Key in Settings.' : '请先在设置页面填入 DeepSeek API Key')
      return callDeepSeek(deepseekKey, prompt, maxTokens)
    default:
      throw new Error(isEn ? 'Unknown AI provider.' : '未知的 AI Provider')
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export async function analyzeSentence(
  settings: Settings,
  sentence: string
): Promise<SentenceAnalysis> {
  const aiText = await callAI(settings, buildSentenceAnalysisPrompt(sentence, settings.language), estimateMaxTokens(sentence))
  const parsed = extractJSON(aiText) as SentenceAnalysis

  // Enrich AI words with local dictionary data (reading, meaning, pitch, jlpt)
  if (parsed.words?.length) {
    const { lookupWordAsync } = await import('./dict')
    parsed.words = await Promise.all(parsed.words.map(async w => {
      const entry = await lookupWordAsync(w.word, w.reading)
      if (!entry) return w
      const meaning = settings.language === 'zh'
        ? (entry.zh?.[0] ?? entry.en?.[0] ?? w.meaning)
        : (entry.en?.[0] ?? w.meaning)
      return {
        ...w,
        reading: entry.r ?? w.reading,
        meaning,
        ...(entry.p !== undefined ? { pitch: entry.p } : {}),
        ...(entry.jlpt ? { jlpt: entry.jlpt } : {}),
      }
    }))
  }

  parsed.furigana = generateFurigana(sentence, parsed.words ?? [])
  return parsed
}

export async function getWordDetails(
  settings: Settings,
  word: string,
  reading: string,
  pos: string
): Promise<WordDetails> {
  const prompt = buildWordDetailsPrompt(word, reading, pos, settings.language)
  const text = await callAI(settings, prompt)
  const parsed = extractJSON(text) as WordDetails
  return parsed
}

export async function getGrammarDetails(
  settings: Settings,
  pattern: string,
  meaning: string
): Promise<GrammarDetails> {
  const prompt = buildGrammarDetailsPrompt(pattern, meaning, settings.language)
  const text = await callAI(settings, prompt)
  return extractJSON(text) as GrammarDetails
}

export async function testApiKey(settings: Settings): Promise<void> {
  await callAI(settings, buildTestPrompt(settings.language))
}
