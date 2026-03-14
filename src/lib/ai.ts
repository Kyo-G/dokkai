import type { Settings, SentenceAnalysis, WordDetails, GrammarDetails } from '../types'

// ──────────────────────────────────────────────
// Prompt builders
// ──────────────────────────────────────────────

function buildSentenceAnalysisPrompt(sentence: string, language: 'zh' | 'en'): string {
  if (language === 'en') {
    return `You are a professional Japanese language teacher. Analyze the following Japanese sentence and return a strict JSON format with English explanations.

Sentence to analyze: 「${sentence}」

Return the following JSON structure (no extra text, JSON only):
{
  "furigana": "The full sentence with furigana added to all kanji using the format {漢字|よみ}; hiragana, katakana, punctuation and numbers stay as-is",
  "structure": [
    {"text": "sentence segment", "role": "Subject / Predicate / Object / Modifier / Complement / Conjunction / etc."}
  ],
  "grammar": [
    {
      "pattern": "grammar pattern",
      "meaning": "meaning in English",
      "usage": "usage explanation",
      "jlpt": "N3"
    }
  ],
  "words": [
    {
      "word": "dictionary form",
      "reading": "kana reading",
      "pos": "part of speech (noun / verb / adjective / adverb / particle / etc.)",
      "meaning": "English meaning",
      "pitch": 0,
      "jlpt": "N3"
    }
  ]
}

Notes:
- furigana: only annotate characters that are kanji in the original text using {漢字|よみ}; leave hiragana, katakana, punctuation and numbers unchanged. Never convert kana words to kanji just to annotate them. Example: {私|わたし}は{日本語|にほんご}が{好き|すき}です。（は、が、です are not annotated）
- structure must cover the entire sentence without omissions
- grammar should list only noteworthy grammar points; may be an empty array
- words should list the main words in the sentence (exclude simple particles like は、が、を、に)
- pitch is the Tokyo dialect pitch accent nucleus position: 0 = flat (heiban), 1 = head-high (atamadaka), 2+ = middle/tail-high; use an integer
- jlpt: fill in the JLPT level (N5/N4/N3/N2/N1) for each word; leave as empty string if uncertain`
  }

  return `你是一位专业的日语教师，请分析以下日语句子，用中文解释，返回严格的JSON格式。

待分析句子：「${sentence}」

请返回如下JSON结构（不要有任何多余的文字，只返回JSON）：
{
  "furigana": "整个句子，对所有汉字标注振假名，格式为{漢字|よみ}，假名和符号保持原样",
  "structure": [
    {"text": "句子片段", "role": "主语/谓语/宾语/修饰成分/补语/连词 等"}
  ],
  "grammar": [
    {
      "pattern": "语法形式",
      "meaning": "意思",
      "usage": "用法说明",
      "jlpt": "N3"
    }
  ],
  "words": [
    {
      "word": "单词原形",
      "reading": "假名读音",
      "pos": "词性（名词/动词/形容词/副词/助词 等）",
      "meaning": "中文释义",
      "pitch": 0,
      "jlpt": "N3"
    }
  ]
}

注意：
- furigana 字段：只对原文中本身就是汉字的部分加标注，格式{漢字|よみ}；平假名、片假名、符号、数字一律原样保留，禁止把假名词转换成汉字再标注。例：{私|わたし}は{日本語|にほんご}が{好き|すき}です。（「は」「が」「です」不加标注）
- structure 要覆盖整个句子，不能遗漏
- grammar 只列出值得学习的语法点，可以为空数组
- words 列出句中主要单词（排除简单助词如は、が、を、に）
- pitch 为东京方言音调核位置：0=平板型（无下降），1=头高型，2及以上=中高型/尾高型，填整数
- jlpt 填该单词对应的 JLPT 等级（N5/N4/N3/N2/N1），不确定时填空字符串`
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

async function callClaude(apiKey: string, prompt: string): Promise<string> {
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
      max_tokens: 2048,
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

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || `OpenAI API error: ${response.status}`)
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

async function callDeepSeek(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || `DeepSeek API error: ${response.status}`)
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048 },
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

async function callAI(settings: Settings, prompt: string): Promise<string> {
  const { provider, claudeKey, openaiKey, geminiKey, deepseekKey, language } = settings
  const isEn = language === 'en'
  switch (provider) {
    case 'claude':
      if (!claudeKey) throw new Error(isEn ? 'Please enter your Claude API Key in Settings.' : '请先在设置页面填入 Claude API Key')
      return callClaude(claudeKey, prompt)
    case 'openai':
      if (!openaiKey) throw new Error(isEn ? 'Please enter your OpenAI API Key in Settings.' : '请先在设置页面填入 OpenAI API Key')
      return callOpenAI(openaiKey, prompt)
    case 'gemini':
      if (!geminiKey) throw new Error(isEn ? 'Please enter your Gemini API Key in Settings.' : '请先在设置页面填入 Gemini API Key')
      return callGemini(geminiKey, prompt)
    case 'deepseek':
      if (!deepseekKey) throw new Error(isEn ? 'Please enter your DeepSeek API Key in Settings.' : '请先在设置页面填入 DeepSeek API Key')
      return callDeepSeek(deepseekKey, prompt)
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
  const prompt = buildSentenceAnalysisPrompt(sentence, settings.language)
  const text = await callAI(settings, prompt)
  const parsed = extractJSON(text) as SentenceAnalysis
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
