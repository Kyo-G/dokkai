import { supabase } from './supabase'
import type {
  Article, Sentence, Word, ReviewRecord,
  SentenceAnalysis, WordDetails, ArticleLevel, ReviewGrade,
  SavedGrammar, GrammarReviewRecord
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

export async function createArticle(
  title: string,
  content: string,
  level: ArticleLevel
): Promise<Article> {
  const { data, error } = await supabase
    .from('articles')
    .insert({ title: title || '无标题', content, level })
    .select()
    .single()
  if (error) throw error

  // Create sentences
  const sentences = splitIntoSentences(content)
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

export async function getWord(id: string): Promise<Word | null> {
  const { data, error } = await supabase
    .from('words')
    .select(`*, articles(title)`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data ? { ...data, article_title: (data as Word & { articles?: { title: string } }).articles?.title } : null
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
