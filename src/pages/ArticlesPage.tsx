import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Pencil, FileText, Loader2 } from 'lucide-react'
import { getArticles, deleteArticle, getArticleWordLevels, getArticleAnalysisProgress, getAllUnanalyzedSentences, saveSentenceAnalysis } from '../lib/db'
import { analyzeSentence } from '../lib/ai'
import { getCachedImage, setCachedImage, fetchArticleImage } from '../lib/unsplash'
import type { Article } from '../types'
import { getProgress } from '../lib/progress'
import { useSettings } from '../hooks/useSettings'
import { getT } from '../lib/i18n'

const LEVEL_COLORS: Record<string, string> = {
  N5: 'bg-green-100 text-green-700',
  N4: 'bg-blue-100 text-blue-700',
  N3: 'bg-yellow-100 text-yellow-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
}

const JLPT_LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5'] as const
const JLPT_BAR_COLOR: Record<string, string> = {
  N1: '#ef4444',
  N2: '#fb923c',
  N3: '#facc15',
  N4: '#60a5fa',
  N5: '#4ade80',
}
const LEVEL_BAR: Record<string, string> = {
  N5: 'bg-green-400',
  N4: 'bg-blue-400',
  N3: 'bg-yellow-400',
  N2: 'bg-orange-400',
  N1: 'bg-red-500',
}

// Width in px of the revealed action panel (edit + delete)
const ACTION_WIDTH = 128

export default function ArticlesPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const t = getT(settings.language)
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [wordLevels, setWordLevels] = useState<Map<string, Record<string, number>>>(new Map())
  const [analysisProgress, setAnalysisProgress] = useState<Map<string, { total: number; analyzed: number }>>(new Map())
  const [images, setImages] = useState<Record<string, string>>({})
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<{ id: string; offset: number } | null>(null)
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    axis: 'x' | 'y' | null
    baseOffset: number
  } | null>(null)
  const analyzeActiveRef = useRef(false)

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') refreshProgress() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      analyzeActiveRef.current = false
    }
  }, [])

  async function refreshProgress() {
    const progress = await getArticleAnalysisProgress()
    setAnalysisProgress(progress)
  }

  async function runBackgroundAnalysis() {
    const apiKey = settings.claudeKey || settings.openaiKey || settings.geminiKey || settings.deepseekKey
    if (!apiKey) return
    const unanalyzed = await getAllUnanalyzedSentences()
    if (unanalyzed.length === 0) return
    analyzeActiveRef.current = true
    for (const sentence of unanalyzed) {
      if (!analyzeActiveRef.current) break
      try {
        const result = await analyzeSentence(settings, sentence.content)
        if (!analyzeActiveRef.current) break
        await saveSentenceAnalysis(sentence.id, result)
        setAnalysisProgress(prev => {
          const next = new Map(prev)
          const cur = next.get(sentence.article_id) ?? { total: 0, analyzed: 0 }
          next.set(sentence.article_id, { ...cur, analyzed: cur.analyzed + 1 })
          return next
        })
      } catch { /* skip failed sentence */ }
    }
    analyzeActiveRef.current = false
  }

  async function load() {
    try {
      const [data, levels, progress] = await Promise.all([getArticles(), getArticleWordLevels(), getArticleAnalysisProgress()])
      setArticles(data)
      setWordLevels(levels)
      setAnalysisProgress(progress)

      const cached: Record<string, string> = {}
      for (const a of data) {
        const url = getCachedImage(a.id)
        if (url) cached[a.id] = url
      }
      setImages(cached)

      if (settings.unsplashKey) {
        for (const a of data) {
          if (cached[a.id]) continue
          fetchArticleImage(a.title, settings.unsplashKey).then(url => {
            if (!url) return
            setCachedImage(a.id, url)
            setImages(prev => ({ ...prev, [a.id]: url }))
          })
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      runBackgroundAnalysis()
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteArticle(id)
      setArticles(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : t.delete)
    } finally {
      setDeleteId(null)
    }
  }

  function formatDate(str: string) {
    const locale = settings.language === 'en' ? 'en-US' : 'zh-CN'
    return new Date(str).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

  function handleCardTouchStart(e: React.TouchEvent, id: string) {
    // Close other open card when starting a new touch
    if (openCardId && openCardId !== id) setOpenCardId(null)
    dragRef.current = {
      id,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      axis: null,
      baseOffset: openCardId === id ? -ACTION_WIDTH : 0,
    }
  }

  function handleCardTouchMove(e: React.TouchEvent) {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.touches[0].clientX - drag.startX
    const dy = e.touches[0].clientY - drag.startY
    if (!drag.axis) {
      if (Math.abs(dx) > Math.abs(dy) + 4) drag.axis = 'x'
      else if (Math.abs(dy) > Math.abs(dx) + 4) drag.axis = 'y'
      else return
    }
    if (drag.axis === 'y') return
    const newOffset = Math.max(-ACTION_WIDTH, Math.min(0, drag.baseOffset + dx))
    setDragState({ id: drag.id, offset: newOffset })
  }

  function handleCardTouchEnd() {
    const drag = dragRef.current
    if (!drag) { dragRef.current = null; return }
    if (drag.axis === 'x' && dragState) {
      setOpenCardId(dragState.offset < -ACTION_WIDTH / 2 ? drag.id : null)
    }
    setDragState(null)
    dragRef.current = null
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">読解</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t.articlesSubtitle}</p>
        </div>
        <button
          onClick={() => navigate('/import')}
          className="flex items-center gap-1.5 bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
        >
          <Plus size={16} />
          {t.importArticle}
        </button>
      </div>

      {/* Article list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t.noArticles}</p>
          <p className="text-xs mt-1">{t.noArticlesHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map(article => (
            <div key={article.id} className="relative">
              {deleteId === article.id ? (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-sm text-red-700">{t.confirmDelete(article.title)}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteId(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#333] rounded-lg"
                    >{t.cancel}</button>
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg"
                    >{t.delete}</button>
                  </div>
                </div>
              ) : (
                <div
                  className="relative overflow-hidden rounded-2xl"
                  onTouchStart={e => handleCardTouchStart(e, article.id)}
                  onTouchMove={handleCardTouchMove}
                  onTouchEnd={handleCardTouchEnd}
                >
                  {/* Action buttons revealed on left swipe */}
                  <div
                    className="absolute inset-y-0 right-0 flex"
                    style={{ width: ACTION_WIDTH }}
                  >
                    <button
                      className="flex-1 bg-blue-500 flex flex-col items-center justify-center gap-1 text-white"
                      onClick={() => { setOpenCardId(null); navigate(`/import?edit=${article.id}`) }}
                    >
                      <Pencil size={18} />
                      <span className="text-[10px] font-medium">{t.save === '保存' ? '编辑' : 'Edit'}</span>
                    </button>
                    <button
                      className="flex-1 bg-red-500 flex flex-col items-center justify-center gap-1 text-white rounded-r-2xl"
                      onClick={() => { setOpenCardId(null); setDeleteId(article.id) }}
                    >
                      <Trash2 size={18} />
                      <span className="text-[10px] font-medium">{t.delete}</span>
                    </button>
                  </div>

                  {/* Sliding card content */}
                  <div
                    style={{
                      transform: `translateX(${dragState?.id === article.id ? dragState.offset : openCardId === article.id ? -ACTION_WIDTH : 0}px)`,
                      transition: dragState?.id === article.id ? 'none' : 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)',
                      willChange: 'transform',
                    }}
                  >
                    <Link
                      to={`/article/${article.id}`}
                      className="flex flex-col bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl overflow-hidden"
                      onClick={e => { if (openCardId === article.id) { e.preventDefault(); setOpenCardId(null) } }}
                    >
                      {(() => {
                        const prog = getProgress(article.id)
                        const pct = prog.total > 0 ? Math.round(prog.readIds.length / prog.total * 100) : 0
                        return (
                          <div className="flex items-stretch" style={{ height: 96 }}>
                            {/* Thumbnail — 128×96 = 4:3 */}
                            {images[article.id] && (
                              <div className="shrink-0 overflow-hidden" style={{ width: 128 }}>
                                <img
                                  src={images[article.id]}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                              <span className="font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 text-sm">
                                {article.title}
                              </span>
                              {(() => {
                                const ap = analysisProgress.get(article.id)
                                const analyzing = ap && ap.analyzed < ap.total
                                const apPct = ap ? Math.round(ap.analyzed / ap.total * 100) : 0
                                return (
                                  <>
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <span className="text-[11px] text-gray-300 dark:text-gray-600 shrink-0">{formatDate(article.created_at)}</span>
                                      {article.level && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${LEVEL_COLORS[article.level] || ''}`}>
                                          {article.level}
                                        </span>
                                      )}
                                      <span className="ml-auto shrink-0 flex items-center gap-1.5">
                                        {analyzing ? (
                                          <span className="text-[10px] text-blue-400 dark:text-blue-500 font-medium">分析中 {ap!.analyzed}/{ap!.total} · {apPct}%</span>
                                        ) : prog.total > 0 && (
                                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                            {prog.readIds.length}/{prog.total}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    {(prog.total > 0 || analyzing) && (
                                      <div className="h-1 bg-gray-100 dark:bg-[#2a2a2a] rounded-full overflow-hidden mt-1.5">
                                        {analyzing ? (
                                          <div className="h-full bg-blue-400 dark:bg-blue-500 rounded-full transition-all" style={{ width: `${apPct}%` }} />
                                        ) : (
                                          <div className="h-full bg-green-400 dark:bg-green-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        )}
                                      </div>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Bottom JLPT bar */}
                      {(() => {
                        const dist = wordLevels.get(article.id)
                        const total = dist ? Object.values(dist).reduce((a, b) => a + b, 0) : 0
                        if (!dist || total === 0) {
                          return <div className={`h-1 shrink-0 ${LEVEL_BAR[article.level] ?? 'bg-gray-100 dark:bg-[#2a2a2a]'}`} />
                        }
                        return (
                          <div className="h-1 shrink-0 flex">
                            {JLPT_LEVELS.map(level => {
                              const count = dist[level] ?? 0
                              if (count === 0) return null
                              return (
                                <div
                                  key={level}
                                  style={{ flex: count, backgroundColor: JLPT_BAR_COLOR[level] }}
                                />
                              )
                            })}
                          </div>
                        )
                      })()}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
