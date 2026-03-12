import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { GrammarDetails } from '../types'
import { useSettings } from '../hooks/useSettings'
import { getGrammarDetails } from '../lib/ai'
import { saveGrammarDetails } from '../lib/db'
import Furigana from './Furigana'

interface GrammarLike {
  id?: string
  pattern: string
  meaning: string
  jlpt?: string
  details_cache?: GrammarDetails | null
}

interface Props {
  grammar: GrammarLike
  onClose: () => void
}

function localKey(pattern: string) { return `dokkai_grammar_${pattern}` }
function getLocalCache(pattern: string): GrammarDetails | null {
  try { return JSON.parse(localStorage.getItem(localKey(pattern)) || 'null') } catch { return null }
}
function setLocalCache(pattern: string, d: GrammarDetails) {
  try { localStorage.setItem(localKey(pattern), JSON.stringify(d)) } catch {}
}

export default function GrammarDetailSheet({ grammar, onClose }: Props) {
  const { settings } = useSettings()
  const [details, setDetails] = useState<GrammarDetails | null>(
    grammar.details_cache || getLocalCache(grammar.pattern) || null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!details) fetchDetails()
  }, [])

  async function fetchDetails() {
    setLoading(true)
    setError('')
    try {
      const d = await getGrammarDetails(settings, grammar.pattern, grammar.meaning)
      setDetails(d)
      setLocalCache(grammar.pattern, d)
      if (grammar.id) await saveGrammarDetails(grammar.id, d)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取详情失败')
    } finally {
      setLoading(false)
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
          <div>
            <div className="font-jp text-2xl font-bold text-amber-900 dark:text-amber-300" lang="ja">{grammar.pattern}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {grammar.jlpt && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">{grammar.jlpt}</span>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">{grammar.meaning}</span>
            </div>
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
                <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">用法</div>
                <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{details.usage}</div>
              </div>
              {details.nuance && (
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">语感</div>
                  <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{details.nuance}</div>
                </div>
              )}
              {details.examples?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">例句</div>
                  <div className="space-y-3">
                    {details.examples.map((ex, i) => (
                      <div key={i} className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3">
                        <Furigana text={ex.japanese} className="font-jp text-gray-900 dark:text-gray-100 leading-loose" />
                        <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">{ex.chinese}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
