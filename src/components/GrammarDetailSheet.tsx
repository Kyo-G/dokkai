import { useState, useEffect } from 'react'
import { X, Loader2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import type { GrammarDetails } from '../types'
import { useSettings } from '../hooks/useSettings'
import { getGrammarDetails } from '../lib/ai'
import { saveGrammarDetails, getUserExamplesForGrammar, type UserSentenceExample } from '../lib/db'
import Furigana from './Furigana'
import { useNavigate } from 'react-router-dom'

type UserExample = UserSentenceExample

interface GrammarLike {
  id?: string
  pattern: string
  meaning: string
  usage?: string
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
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const { settings } = useSettings()
  const navigate = useNavigate()
  const [userExamples, setUserExamples] = useState<UserExample[] | null>(null)
  const [aiDetails, setAiDetails] = useState<GrammarDetails | null>(
    grammar.details_cache || getLocalCache(grammar.pattern) || null
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiExpanded, setAiExpanded] = useState(false)
  const [showAllEx, setShowAllEx] = useState(false)

  useEffect(() => {
    getUserExamplesForGrammar(grammar.pattern)
      .then(setUserExamples)
      .catch(() => setUserExamples([]))
  }, [grammar.pattern])

  async function loadAiDetails() {
    if (aiDetails) { setAiExpanded(v => !v); return }
    setAiExpanded(true)
    setAiLoading(true)
    setAiError('')
    try {
      const d = await getGrammarDetails(settings, grammar.pattern, grammar.meaning)
      setAiDetails(d)
      setLocalCache(grammar.pattern, d)
      if (grammar.id) await saveGrammarDetails(grammar.id, d).catch(() => {})
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '获取详情失败')
    } finally {
      setAiLoading(false)
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
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100 dark:border-[#2a2a2a] shrink-0">
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

          {/* 用法 — from sentence analysis, available immediately */}
          {grammar.usage && (
            <section>
              <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">用法</div>
              <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{grammar.usage}</div>
            </section>
          )}

          {/* 我读过的句子 */}
          <section>
            <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <BookOpen size={11} />
              我读过的句子
            </div>
            {userExamples === null ? (
              <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                <Loader2 size={14} className="animate-spin" /> 搜索中…
              </div>
            ) : userExamples.length > 0 ? (
              <div className="space-y-2">
                {(showAllEx ? userExamples : userExamples.slice(0, 2)).map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => { onClose(); navigate(`/article/${ex.articleId}?sentence=${ex.sentenceId}`) }}
                    className="w-full text-left bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 active:bg-amber-100 dark:active:bg-amber-950/40"
                  >
                    <div className="font-jp text-sm text-gray-800 dark:text-gray-200 leading-relaxed" lang="ja">
                      {ex.furigana ? <Furigana text={ex.furigana} /> : ex.content}
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                      <BookOpen size={10} />
                      {ex.articleTitle}
                    </div>
                  </button>
                ))}
                {userExamples.length > 2 && (
                  <button
                    onClick={() => setShowAllEx(v => !v)}
                    className="text-xs text-gray-400 dark:text-gray-500 underline w-full text-center pt-1"
                  >
                    {showAllEx ? '收起' : `更多（共 ${userExamples.length} 句）`}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                暂无 — 还没在文章中遇到过这个语法
              </div>
            )}
          </section>

          {/* AI 用法解析 — on demand */}
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
              <div className="mt-3 space-y-4 animate-fade-in-down">
                {aiDetails.nuance && (
                  <div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">语感</div>
                    <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{aiDetails.nuance}</div>
                  </div>
                )}
                {aiDetails.examples?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">例句</div>
                    <div className="space-y-3">
                      {aiDetails.examples.map((ex, i) => (
                        <div key={i} className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3">
                          <Furigana text={ex.japanese} className="font-jp text-gray-900 dark:text-gray-100 leading-loose" />
                          <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">{ex.chinese}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
