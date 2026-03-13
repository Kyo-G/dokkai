import { useState, useEffect } from 'react'
import { X, BookmarkPlus, Loader2, Check, Volume2, Square, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import type { Word, WordDetails, WordInSentence } from '../types'
import { useSettings } from '../hooks/useSettings'
import { getWordDetails } from '../lib/ai'
import { addWord, saveWordDetails, getUserExamplesForWord } from '../lib/db'
import { lookupWordAsync, getDictStatus } from '../lib/dict'
import type { DictEntry } from '../lib/dict'
import { useSpeech } from '../hooks/useSpeech'
import Furigana from './Furigana'
import { useNavigate } from 'react-router-dom'

interface UserExample {
  content: string
  furigana?: string
  articleTitle: string
  articleId: string
}

interface Props {
  wordInfo: WordInSentence
  articleId: string | null
  sentenceId?: string | null
  existingWord?: Word | null
  onClose: () => void
}

export default function WordDetailSheet({ wordInfo, articleId, sentenceId, existingWord, onClose }: Props) {
  const { settings } = useSettings()
  const { speak, stop, speaking } = useSpeech()
  const navigate = useNavigate()

  // ── Dict ──────────────────────────────────────────────────────────
  const [dictEntry, setDictEntry] = useState<DictEntry | null>(null)
  const [dictLoading, setDictLoading] = useState(getDictStatus() !== 'ready')

  // ── User's own sentences ──────────────────────────────────────────
  const [userExamples, setUserExamples] = useState<UserExample[]>([])
  const [userExLoading, setUserExLoading] = useState(true)

  // ── AI usage notes (on-demand) ────────────────────────────────────
  const [aiDetails, setAiDetails] = useState<WordDetails | null>(
    existingWord?.details_cache ?? null
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiExpanded, setAiExpanded] = useState(false)

  // ── Vocab book ────────────────────────────────────────────────────
  const [added, setAdded] = useState(!!existingWord)
  const [adding, setAdding] = useState(false)

  const pitch = wordInfo.pitch ?? existingWord?.details_cache?.pitch ?? dictEntry?.p

  useEffect(() => {
    // Lookup in local dictionary
    lookupWordAsync(wordInfo.word, wordInfo.reading).then(entry => {
      setDictEntry(entry)
      setDictLoading(false)
    })

    // Fetch user's own examples
    getUserExamplesForWord(wordInfo.word)
      .then(setUserExamples)
      .catch(() => {})
      .finally(() => setUserExLoading(false))
  }, [wordInfo.word, wordInfo.reading])

  async function loadAiDetails() {
    if (aiDetails) { setAiExpanded(v => !v); return }
    setAiExpanded(true)
    setAiLoading(true)
    setAiError('')
    try {
      const d = await getWordDetails(settings, wordInfo.word, wordInfo.reading, wordInfo.pos)
      setAiDetails(d)
      if (existingWord) await saveWordDetails(existingWord.id, d).catch(() => {})
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '获取失败')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleAddToVocab() {
    setAdding(true)
    try {
      const w = await addWord(wordInfo.word, wordInfo.reading, wordInfo.pos, wordInfo.meaning, articleId, sentenceId ?? null)
      if (aiDetails) await saveWordDetails(w.id, aiDetails).catch(() => {})
      setAdded(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : '添加失败')
    } finally {
      setAdding(false)
    }
  }

    return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white dark:bg-[#1e1e1e] rounded-t-2xl max-h-[88dvh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100 dark:border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="font-jp text-2xl font-bold text-gray-900 dark:text-gray-100" lang="ja">
                {wordInfo.word}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-jp" lang="ja">
                  {wordInfo.reading}
                </span>
                {pitch !== undefined && (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-0.5 leading-none">
                    {pitch}
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {dictEntry?.pos ?? wordInfo.pos}
                </span>
                {wordInfo.jlpt && (
                  <span className="text-xs bg-gray-100 dark:bg-[#333] text-gray-500 dark:text-gray-400 rounded px-1.5 py-0.5">
                    {wordInfo.jlpt}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => speaking ? stop() : speak(wordInfo.word)}
              className="text-gray-400 dark:text-gray-500 active:text-red-600 mt-1"
            >
              {speaking ? <Square size={16} fill="currentColor" /> : <Volume2 size={20} />}
            </button>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 dark:text-gray-500 mt-1">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ── 释义 ─────────────────────────────────────────────── */}
          <section>
            <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">释义</div>

            {/* Primary: AI-provided Chinese meaning (always in Chinese, context-aware) */}
            <div className="text-gray-900 dark:text-gray-100 font-medium">{wordInfo.meaning}</div>

            {/* Supplementary: English meanings from local dict */}
            {!dictLoading && dictEntry?.en && dictEntry.en.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {dictEntry.en.map((m, i) => (
                  <div key={i} className="flex gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    {dictEntry.en!.length > 1 && (
                      <span className="shrink-0 tabular-nums">{i + 1}.</span>
                    )}
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── 我读过的句子 ─────────────────────────────────────── */}
          <section>
            <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <BookOpen size={11} />
              我读过的句子
            </div>
            {userExLoading ? (
              <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                <Loader2 size={14} className="animate-spin" /> 搜索中…
              </div>
            ) : userExamples.length > 0 ? (
              <div className="space-y-2">
                {userExamples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => { onClose(); navigate(`/article/${ex.articleId}`) }}
                    className="w-full text-left bg-red-50 dark:bg-red-950/20 rounded-xl p-3 active:bg-red-100 dark:active:bg-red-950/40"
                  >
                    <div className="font-jp text-sm text-gray-800 dark:text-gray-200 leading-relaxed" lang="ja">
                      {ex.furigana
                        ? <Furigana text={ex.furigana} />
                        : ex.content
                      }
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                      <BookOpen size={10} />
                      {ex.articleTitle}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                暂无 — 还没在其他文章中遇到过这个词
              </div>
            )}
          </section>

          {/* ── Tatoeba 例句 ─────────────────────────────────────── */}
          {dictEntry?.ex && dictEntry.ex.length > 0 && (
            <section>
              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                Tatoeba 例句
              </div>
              <div className="space-y-2">
                {dictEntry.ex.map((ex, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-[#252525] rounded-xl p-3">
                    <div className="font-jp text-sm text-gray-800 dark:text-gray-200 leading-relaxed" lang="ja">
                      {ex.j}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ex.c}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── AI 用法解析 (on-demand) ──────────────────────────── */}
          <section>
            <button
              onClick={loadAiDetails}
              className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 w-full"
            >
              <span className="text-xs uppercase tracking-wide font-medium">AI 用法解析</span>
              {aiLoading
                ? <Loader2 size={13} className="animate-spin ml-auto" />
                : aiExpanded
                  ? <ChevronUp size={14} className="ml-auto" />
                  : <ChevronDown size={14} className="ml-auto" />
              }
            </button>

            {aiError && (
              <div className="text-red-600 text-sm mt-2 bg-red-50 dark:bg-red-950/30 rounded-lg p-2">
                {aiError}
                <button onClick={loadAiDetails} className="ml-2 underline">重试</button>
              </div>
            )}

            {aiExpanded && aiDetails && (
              <div className="mt-3 space-y-3 animate-fade-in-down">
                {aiDetails.usage && (
                  <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed bg-gray-50 dark:bg-[#252525] rounded-xl p-3">
                    {aiDetails.usage}
                  </div>
                )}
                {aiDetails.examples?.length > 0 && (
                  <div className="space-y-2">
                    {aiDetails.examples.map((ex, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-[#252525] rounded-xl p-3">
                        <Furigana text={ex.japanese} className="font-jp text-sm text-gray-800 dark:text-gray-200 leading-loose" />
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ex.chinese}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-[#2a2a2a] shrink-0">
          {added ? (
            <div className="flex items-center justify-center gap-2 py-3 text-green-700 font-medium">
              <Check size={18} /> 已加入生词本
            </div>
          ) : (
            <button
              onClick={handleAddToVocab}
              disabled={adding}
              className="w-full py-3 bg-red-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {adding ? <Loader2 size={18} className="animate-spin" /> : <BookmarkPlus size={18} />}
              加入生词本
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
