import { useState, useEffect } from 'react'
import { X, BookmarkPlus, Loader2, Check, Volume2, Square } from 'lucide-react'
import type { Word, WordDetails, WordInSentence } from '../types'
import { useSettings } from '../hooks/useSettings'
import { getWordDetails } from '../lib/ai'
import { addWord, saveWordDetails } from '../lib/db'
import { useSpeech } from '../hooks/useSpeech'

interface Props {
  wordInfo: WordInSentence
  articleId: string | null
  sentenceId?: string | null
  existingWord?: Word | null
  onClose: () => void
}

function localCacheKey(word: string) { return `dokkai_word_${word}` }
function getLocalCache(word: string): WordDetails | null {
  try { return JSON.parse(localStorage.getItem(localCacheKey(word)) || 'null') } catch { return null }
}
function setLocalCache(word: string, details: WordDetails) {
  try { localStorage.setItem(localCacheKey(word), JSON.stringify(details)) } catch {}
}

export default function WordDetailSheet({ wordInfo, articleId, sentenceId, existingWord, onClose }: Props) {
  const { settings } = useSettings()
  const { speak, stop, speaking } = useSpeech()
  const [details, setDetails] = useState<WordDetails | null>(
    existingWord?.details_cache || getLocalCache(wordInfo.word) || null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(!!existingWord)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!details) {
      fetchDetails()
    }
  }, [])

  async function fetchDetails() {
    setLoading(true)
    setError('')
    try {
      if (existingWord?.is_detailed && existingWord.details_cache) {
        setDetails(existingWord.details_cache)
        return
      }
      const d = await getWordDetails(settings, wordInfo.word, wordInfo.reading, wordInfo.pos)
      setDetails(d)
      setLocalCache(wordInfo.word, d) // always cache locally
      if (existingWord) {
        await saveWordDetails(existingWord.id, d)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取详情失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddToVocab() {
    setAdding(true)
    try {
      const w = await addWord(wordInfo.word, wordInfo.reading, wordInfo.pos, wordInfo.meaning, articleId, sentenceId ?? null)
      if (details) {
        await saveWordDetails(w.id, details)
      }
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
        className="relative bg-white dark:bg-[#1e1e1e] rounded-t-2xl max-h-[85dvh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100 dark:border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div>
              <div className="font-jp text-2xl font-bold text-gray-900 dark:text-gray-100" lang="ja">{wordInfo.word}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5" lang="ja">{wordInfo.reading} · {wordInfo.pos}</div>
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

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-8 justify-center">
              <Loader2 size={20} className="animate-spin" />
              <span>正在获取详情…</span>
            </div>
          )}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
              {error}
              <button onClick={fetchDetails} className="ml-2 underline">重试</button>
            </div>
          )}
          {details && (
            <>
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">释义</div>
                <div className="text-gray-900 dark:text-gray-100 font-medium">{details.meaning}</div>
              </div>
              {details.usage && (
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">用法</div>
                  <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{details.usage}</div>
                </div>
              )}
              {details.examples?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">例句</div>
                  <div className="space-y-3">
                    {details.examples.map((ex, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-[#252525] rounded-xl p-3">
                        <div className="font-jp text-gray-900 dark:text-gray-100 leading-relaxed" lang="ja">{ex.japanese}</div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">{ex.chinese}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-[#2a2a2a]">
          {added ? (
            <div className="flex items-center justify-center gap-2 py-3 text-green-700 font-medium">
              <Check size={18} />
              已加入生词本
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
