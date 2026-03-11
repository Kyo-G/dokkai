export type AIProvider = 'claude' | 'openai' | 'gemini' | 'deepseek'

export type ArticleLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | ''

export interface Settings {
  provider: AIProvider
  claudeKey: string
  openaiKey: string
  geminiKey: string
  deepseekKey: string
}

export interface Article {
  id: string
  title: string
  content: string
  level: ArticleLevel
  created_at: string
}

export interface Sentence {
  id: string
  article_id: string
  content: string
  position: number
  analysis_cache: SentenceAnalysis | null
  is_analyzed: boolean
  created_at: string
}

export interface SentenceAnalysis {
  structure: StructurePart[]
  grammar: GrammarPoint[]
  words: WordInSentence[]
}

export interface StructurePart {
  text: string
  role: string // 主语 / 谓语 / 宾语 / 修饰成分 etc.
  color?: string
}

export interface GrammarPoint {
  pattern: string
  meaning: string
  usage: string
  jlpt?: string
}

export interface WordInSentence {
  word: string
  reading: string
  pos: string // 词性
  meaning: string
}

export interface Word {
  id: string
  word: string
  reading: string
  pos: string
  meaning: string
  article_id: string | null
  sentence_id: string | null
  article_title?: string
  details_cache: WordDetails | null
  is_detailed: boolean
  created_at: string
}

export interface WordDetails {
  word: string
  reading: string
  pos: string
  meaning: string
  usage: string
  examples: Example[]
}

export interface Example {
  japanese: string
  chinese: string
}

export interface ReviewRecord {
  id: string
  word_id: string
  next_review_date: string
  interval: number
  ease_factor: number
  created_at: string
}

export interface GrammarDetails {
  pattern: string
  meaning: string
  usage: string
  nuance: string
  examples: Example[]
}

export interface SavedGrammar {
  id: string
  pattern: string
  meaning: string
  usage: string
  jlpt: string
  article_id: string | null
  sentence_id: string | null
  article_title?: string
  details_cache: GrammarDetails | null
  created_at: string
}

export interface GrammarReviewRecord {
  id: string
  grammar_id: string
  next_review_date: string
  interval: number
  ease_factor: number
  created_at: string
}

export type ReviewGrade = 0 | 1 | 2 | 3 // 忘了 / 模糊 / 记得 / 很熟
