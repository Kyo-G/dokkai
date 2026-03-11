import { supabase } from './supabase'
import type {
  Article, Sentence, Word, ReviewRecord,
  SentenceAnalysis, WordDetails, ArticleLevel, ReviewGrade
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
  articleId: string | null
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
    .insert({ word, reading, pos, meaning, article_id: articleId, is_detailed: false })
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
// Review Records
// ──────────────────────────────────────────────

export async function getDueReviews(): Promise<(ReviewRecord & { word: Word })[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('review_records')
    .select(`*, word:words(*)`)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getDueCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const { count, error } = await supabase
    .from('review_records')
    .select('*', { count: 'exact', head: true })
    .lte('next_review_date', today)
  if (error) throw error
  return count || 0
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
