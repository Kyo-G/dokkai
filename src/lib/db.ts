import { supabase } from './supabase'
import type {
  Article, Sentence, Word, ReviewRecord,
  SentenceAnalysis, WordDetails, ArticleLevel, ReviewGrade,
  SavedGrammar, GrammarReviewRecord, GrammarDetails
} from '../types'
import { sm2Next, initialSM2State, addDays } from './sm2'
import { splitIntoSentences } from './sentences'

// ──────────────────────────────────────────────
// Articles
// ──────────────────────────────────────────────

export async function getArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getArticle(id: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/**
 * Normalize article content before storing:
 * - If the text has blank lines, treat them as paragraph separators and
 *   strip intra-paragraph newlines so sentences within a paragraph flow together.
 * - If no blank lines exist, keep as-is (each \n = paragraph separator).
 * This ensures groupByParagraph can reliably reconstruct paragraph structure.
 */
function normalizeContent(raw: string): string {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!/\n[ \t]*\n/.test(text)) return text  // no blank lines, keep as-is
  return text
    .split(/\n[ \t]*\n/)
    .map(p => p.replace(/\n/g, '').trim())
    .filter(p => p.length > 0)
    .join('\n')
}

export async function createArticle(
  title: string,
  content: string,
  level: ArticleLevel
): Promise<Article> {
  const normalized = normalizeContent(content)
  const { data, error } = await supabase
    .from('articles')
    .insert({ title: title || '无标题', content: normalized, level })
    .select()
    .single()
  if (error) throw error

  // Create sentences
  const sentences = splitIntoSentences(normalized)
  if (sentences.length > 0) {
    const rows = sentences.map((s, i) => ({
      article_id: data.id,
      content: s,
      position: i,
      is_analyzed: false,
      analysis_cache: null,
    }))
    await supabase.from('sentences').insert(rows)
  }

  return data
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from('articles').delete().eq('id', id)
  if (error) throw error
}

// ──────────────────────────────────────────────
// Sentences
// ──────────────────────────────────────────────

export async function getSentences(articleId: string): Promise<Sentence[]> {
  const { data, error } = await supabase
    .from('sentences')
    .select('*')
    .eq('article_id', articleId)
    .order('position', { ascending: true })
  if (error) throw error
  return data || []
}

export async function saveSentenceAnalysis(
  sentenceId: string,
  analysis: SentenceAnalysis
): Promise<void> {
  const { error } = await supabase
    .from('sentences')
    .update({ analysis_cache: analysis, is_analyzed: true })
    .eq('id', sentenceId)
  if (error) throw error
}

// ──────────────────────────────────────────────
// Words (vocabulary book)
// ──────────────────────────────────────────────

export async function getWords(): Promise<Word[]> {
  const { data, error } = await supabase
    .from('words')
    .select(`*, articles(title)`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((w: Word & { articles?: { title: string } | null }) => ({
    ...w,
    article_title: w.articles?.title,
  }))
}

export async function addWord(
  word: string,
  reading: string,
  pos: string,
  meaning: string,
  articleId: string | null,
  sentenceId: string | null = null
): Promise<Word> {
  // Check if already exists
  const { data: existing } = await supabase
    .from('words')
    .select('id')
    .eq('word', word)
    .maybeSingle()

  if (existing) throw new Error('该单词已在生词本中')

  const { data, error } = await supabase
    .from('words')
    .insert({ word, reading, pos, meaning, article_id: articleId, sentence_id: sentenceId, is_detailed: false })
    .select()
    .single()
  if (error) throw error

  // Initialize review record
  const tomorrow = addDays(new Date(), 1)
  await supabase.from('review_records').insert({
    word_id: data.id,
    next_review_date: tomorrow.toISOString().split('T')[0],
    interval: initialSM2State.interval,
    ease_factor: initialSM2State.easeFactor,
  })

  return data
}

/**
 * Returns a map of { word → interval } for all saved words that are not yet mastered.
 * "Mastered" = interval >= 21 days. Used to highlight known-but-learning words during reading.
 */
export async function getVocabIndex(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('words')
    .select(`word, review_records(interval)`)
  if (error) throw error

  const map = new Map<string, number>()
  for (const row of data || []) {
    const r = (row as { word: string; review_records: { interval: number }[] | null })
    const interval = r.review_records?.[0]?.interval ?? 1
    if (interval < 21) {
      map.set(r.word, interval)
    }
  }
  return map
}

export async function deleteWord(id: string): Promise<void> {
  await supabase.from('review_records').delete().eq('word_id', id)
  const { error } = await supabase.from('words').delete().eq('id', id)
  if (error) throw error
}

export async function saveWordDetails(
  wordId: string,
  details: WordDetails
): Promise<void> {
  const { error } = await supabase
    .from('words')
    .update({ details_cache: details, is_detailed: true })
    .eq('id', wordId)
  if (error) throw error
}

// ──────────────────────────────────────────────
// Grammar points
// ──────────────────────────────────────────────

export async function getGrammars(): Promise<SavedGrammar[]> {
  const { data, error } = await supabase
    .from('grammar_points')
    .select(`*, articles(title)`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((g: SavedGrammar & { articles?: { title: string } | null }) => ({
    ...g,
    article_title: g.articles?.title,
  }))
}

export async function addGrammar(
  pattern: string,
  meaning: string,
  usage: string,
  jlpt: string,
  articleId: string | null,
  sentenceId: string | null = null
): Promise<SavedGrammar> {
  const { data: existing } = await supabase
    .from('grammar_points')
    .select('id')
    .eq('pattern', pattern)
    .maybeSingle()

  if (existing) throw new Error('该语法已在收藏中')

  const { data, error } = await supabase
    .from('grammar_points')
    .insert({ pattern, meaning, usage, jlpt, article_id: articleId, sentence_id: sentenceId })
    .select()
    .single()
  if (error) throw error

  const tomorrow = addDays(new Date(), 1)
  await supabase.from('grammar_review_records').insert({
    grammar_id: data.id,
    next_review_date: tomorrow.toISOString().split('T')[0],
    interval: initialSM2State.interval,
    ease_factor: initialSM2State.easeFactor,
  })

  return data
}

export async function saveGrammarDetails(id: string, details: GrammarDetails): Promise<void> {
  const { error } = await supabase
    .from('grammar_points')
    .update({ details_cache: details })
    .eq('id', id)
  if (error) throw error
}

export async function deleteGrammar(id: string): Promise<void> {
  await supabase.from('grammar_review_records').delete().eq('grammar_id', id)
  const { error } = await supabase.from('grammar_points').delete().eq('id', id)
  if (error) throw error
}

// ──────────────────────────────────────────────
// Review Records
// ──────────────────────────────────────────────

export type WordReviewItem = ReviewRecord & { type: 'word'; word: Word }
export type GrammarReviewItem = GrammarReviewRecord & { type: 'grammar'; grammar: SavedGrammar }
export type AnyReviewItem = WordReviewItem | GrammarReviewItem

export async function getDueReviews(): Promise<AnyReviewItem[]> {
  const today = new Date().toISOString().split('T')[0]
  const [wordsRes, grammarRes] = await Promise.all([
    supabase.from('review_records').select(`*, word:words(*)`).lte('next_review_date', today),
    supabase.from('grammar_review_records').select(`*, grammar:grammar_points(*)`).lte('next_review_date', today),
  ])
  if (wordsRes.error) throw wordsRes.error
  if (grammarRes.error) throw grammarRes.error

  const wordItems: WordReviewItem[] = (wordsRes.data || []).map(r => ({ ...r, type: 'word' as const }))
  const grammarItems: GrammarReviewItem[] = (grammarRes.data || []).map(r => ({ ...r, type: 'grammar' as const }))

  return [...wordItems, ...grammarItems].sort(
    (a, b) => a.next_review_date.localeCompare(b.next_review_date)
  )
}

export async function getDueCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const [wordsRes, grammarRes] = await Promise.all([
    supabase.from('review_records').select('*', { count: 'exact', head: true }).lte('next_review_date', today),
    supabase.from('grammar_review_records').select('*', { count: 'exact', head: true }).lte('next_review_date', today),
  ])
  return (wordsRes.count || 0) + (grammarRes.count || 0)
}

export async function submitGrammarReview(
  recordId: string,
  currentInterval: number,
  currentEase: number,
  grade: ReviewGrade
): Promise<void> {
  const state = sm2Next(
    { interval: currentInterval, easeFactor: currentEase, repetitions: 1 },
    grade
  )
  const nextDate = addDays(new Date(), state.interval)
  const { error } = await supabase
    .from('grammar_review_records')
    .update({ interval: state.interval, ease_factor: state.easeFactor, next_review_date: nextDate.toISOString().split('T')[0] })
    .eq('id', recordId)
  if (error) throw error
}

export type UserSentenceExample = {
  sentenceId: string
  content: string
  furigana?: string
  articleTitle: string
  articleId: string
}

function mapExamples(data: unknown[]): UserSentenceExample[] {
  return data.map((s: unknown) => {
    const row = s as { id: string; content: string; analysis_cache: unknown; article_id: string; articles?: { title: string } | null }
    return {
      sentenceId:   row.id,
      content:      row.content,
      furigana:     (row.analysis_cache as { furigana?: string } | null)?.furigana,
      articleTitle: row.articles?.title ?? '未知文章',
      articleId:    row.article_id,
    }
  })
}

/** Find the user's own analyzed sentences that contain this grammar pattern. */
export async function getUserExamplesForGrammar(pattern: string): Promise<UserSentenceExample[]> {
  const { data, error } = await supabase
    .from('sentences')
    .select('id, content, analysis_cache, article_id, articles(title)')
    .filter('analysis_cache', 'cs', JSON.stringify({ grammar: [{ pattern }] }))
    .limit(5)
  if (error) throw error
  return mapExamples(data || [])
}

/**
 * Find the user's own analyzed sentences that contain this word.
 * Uses JSONB @> to match what the AI stored in analysis_cache.
 */
export async function getUserExamplesForWord(word: string): Promise<UserSentenceExample[]> {
  const { data, error } = await supabase
    .from('sentences')
    .select('id, content, analysis_cache, article_id, articles(title)')
    .filter('analysis_cache', 'cs', JSON.stringify({ words: [{ word }] }))
    .limit(5)
  if (error) throw error
  return mapExamples(data || [])
}

export async function submitReview(
  recordId: string,
  currentInterval: number,
  currentEase: number,
  grade: ReviewGrade
): Promise<void> {
  const state = sm2Next(
    { interval: currentInterval, easeFactor: currentEase, repetitions: 1 },
    grade
  )
  const nextDate = addDays(new Date(), state.interval)

  const { error } = await supabase
    .from('review_records')
    .update({
      interval: state.interval,
      ease_factor: state.easeFactor,
      next_review_date: nextDate.toISOString().split('T')[0],
    })
    .eq('id', recordId)
  if (error) throw error
}
