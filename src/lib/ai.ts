import type { Settings, SentenceAnalysis, WordDetails, GrammarDetails } from '../types'

// ──────────────────────────────────────────────
// Prompt builders
// ──────────────────────────────────────────────

function buildSentenceAnalysisPrompt(sentence: string): string {
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
      "meaning": "中文释义"
    }
  ]
}

注意：
- furigana 字段：只对汉字部分标注{漢字|よみ}，假名、符号原样保留，例如：{私|わたし}は{日本語|にほんご}が{好き|すき}です。
- structure 要覆盖整个句子，不能遗漏
- grammar 只列出值得学习的语法点，可以为空数组
- words 列出句中主要单词（排除简单助词如は、が、を、に）`
}

function buildWordDetailsPrompt(word: string, reading: string, pos: string): string {
  return `你是一位专业的日语教师，请详细解释以下日语单词，用中文，返回严格的JSON格式。

单词：${word}（${reading}）[${pos}]

请返回如下JSON结构（不要有任何多余的文字，只返回JSON）：
{
  "word": "${word}",
  "reading": "${reading}",
  "pos": "${pos}",
  "meaning": "完整的中文释义",
  "usage": "用法说明，包括常见搭配和注意事项",
  "examples": [
    {
      "japanese": "日语例句，对汉字用{漢字|よみ}标注振假名",
      "chinese": "中文翻译"
    },
    {
      "japanese": "日语例句2，对汉字用{漢字|よみ}标注振假名",
      "chinese": "中文翻译2"
    },
    {
      "japanese": "日语例句3，对汉字用{漢字|よみ}标注振假名",
      "chinese": "中文翻译3"
    }
  ]
}

注意：examples 中的 japanese 字段，只对汉字标注振假名，格式为{漢字|よみ}，假名和符号保持原样，例如：{彼女|かのじょ}は{日本語|にほんご}が{上手|じょうず}です。`
}

function buildGrammarDetailsPrompt(pattern: string, meaning: string): string {
  return `你是一位专业的日语教师，请详细讲解以下日语语法点，用中文，返回严格的JSON格式。

语法：${pattern}（${meaning}）

请返回如下JSON结构（不要有任何多余的文字，只返回JSON）：
{
  "pattern": "${pattern}",
  "meaning": "${meaning}",
  "usage": "详细的用法说明，包括接续方式和注意事项",
  "nuance": "语感/语气说明，与近似语法的区别",
  "examples": [
    {"japanese": "例句1，对汉字用{漢字|よみ}标注振假名", "chinese": "中文翻译1"},
    {"japanese": "例句2，对汉字用{漢字|よみ}标注振假名", "chinese": "中文翻译2"},
    {"japanese": "例句3，对汉字用{漢字|よみ}标注振假名", "chinese": "中文翻译3"}
  ]
}

注意：examples 中的 japanese 字段，只对汉字标注振假名，格式为{漢字|よみ}，假名和符号保持原样，例如：{彼女|かのじょ}は{日本語|にほんご}が{上手|じょうず}です。`
}

function buildTestPrompt(): string {
  return '请用中文回答：1+1等于几？只回答数字即可。'
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
  const { provider, claudeKey, openaiKey, geminiKey, deepseekKey } = settings
  switch (provider) {
    case 'claude':
      if (!claudeKey) throw new Error('请先在设置页面填入 Claude API Key')
      return callClaude(claudeKey, prompt)
    case 'openai':
      if (!openaiKey) throw new Error('请先在设置页面填入 OpenAI API Key')
      return callOpenAI(openaiKey, prompt)
    case 'gemini':
      if (!geminiKey) throw new Error('请先在设置页面填入 Gemini API Key')
      return callGemini(geminiKey, prompt)
    case 'deepseek':
      if (!deepseekKey) throw new Error('请先在设置页面填入 DeepSeek API Key')
      return callDeepSeek(deepseekKey, prompt)
    default:
      throw new Error('未知的 AI Provider')
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export async function analyzeSentence(
  settings: Settings,
  sentence: string
): Promise<SentenceAnalysis> {
  const prompt = buildSentenceAnalysisPrompt(sentence)
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
  const prompt = buildWordDetailsPrompt(word, reading, pos)
  const text = await callAI(settings, prompt)
  const parsed = extractJSON(text) as WordDetails
  return parsed
}

export async function getGrammarDetails(
  settings: Settings,
  pattern: string,
  meaning: string
): Promise<GrammarDetails> {
  const prompt = buildGrammarDetailsPrompt(pattern, meaning)
  const text = await callAI(settings, prompt)
  return extractJSON(text) as GrammarDetails
}

export async function testApiKey(settings: Settings): Promise<void> {
  await callAI(settings, buildTestPrompt())
}
