import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Play, Square } from 'lucide-react'
import { getArticle, getSentences, saveSentenceAnalysis, getVocabIndex } from '../lib/db'
import { getProgress, markSentenceRead, saveReadPosition, saveMode } from '../lib/progress'
import type { Article, Sentence, SentenceAnalysis } from '../types'
import SentenceItem from '../components/SentenceItem'
import Furigana from '../components/Furigana'
import { analyzeSentence } from '../lib/ai'
import { getCachedImage } from '../lib/unsplash'
import { useSettings } from '../hooks/useSettings'
import { splitIntoSentences } from '../lib/sentences'
import { useSpeech } from '../hooks/useSpeech'
import { getT } from '../lib/i18n'

const LEVEL_COLORS: Record<string, string> = {
  N5: 'bg-green-100 text-green-700',
  N4: 'bg-blue-100 text-blue-700',
  N3: 'bg-yellow-100 text-yellow-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
}

type Mode = 'read' | 'study'

function groupByParagraph(content: string, sentences: Sentence[]): Sentence[][] {
  const byBlankLine = content.split(/\n[ \t]*\n/)
  const paraTexts = byBlankLine.length > 1
    ? byBlankLine.map(p => p.trim()).filter(p => p.length > 0)
    : content.split('\n').filter(p => p.trim().length > 0)

  const groups: Sentence[][] = []
  let idx = 0
  for (const para of paraTexts) {
    const count = splitIntoSentences(para).length
    groups.push(sentences.slice(idx, idx + count))
    idx += count
  }
  if (idx < sentences.length) groups.push(sentences.slice(idx))
  return groups.filter(g => g.length > 0)
}

export default function ArticleReadPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const t = getT(settings.language)
  const [searchParams] = useSearchParams()
  const targetSentenceId = searchParams.get('sentence')
  const sentenceRefs = useRef<Record<string, HTMLElement | null>>({})
  const [article, setArticle] = useState<Article | null>(null)
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(targetSentenceId)
  const [expandedSentence, setExpandedSentence] = useState<string | null>(null)
  const [showFurigana, setShowFurigana] = useState(false)
  const [preProgress, setPreProgress] = useState<{ done: number; total: number } | null>(null)
  const preAnalyzeActive = useRef(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<Mode>('read')
  const [jumpToId, setJumpToId] = useState<string | null>(null)
  const lastSeenRef = useRef<string | null>(null)
  const [vocabIndex, setVocabIndex] = useState<Map<string, number>>(new Map())
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const { stop, speaking, speakSequence } = useSpeech()

  // Swipe-to-switch-mode
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [swipeBlocking, setSwipeBlocking] = useState(false)

  useEffect(() => {
    if (id) load(id)
  }, [id])

  async function load(articleId: string) {
    try {
      const [art, sents, vocab] = await Promise.all([
        getArticle(articleId),
        getSentences(articleId),
        getVocabIndex(),
      ])
      setVocabIndex(vocab)
      if (!art) { setError('文章不存在'); return }
      setArticle(art)
      setSentences(sents)
      setCoverImage(getCachedImage(articleId))

      const prog = getProgress(articleId)
      setReadIds(new Set(prog.readIds))
      if (prog.lastMode && !targetSentenceId) setMode(prog.lastMode)

      const scrollTo = targetSentenceId ?? prog.lastReadId
      if (scrollTo) {
        setTimeout(() => {
          sentenceRefs.current[scrollTo]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          if (targetSentenceId) setTimeout(() => setHighlightId(null), 3000)
        }, 300)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  function handleAnalyzed(sentenceId: string, analysis: SentenceAnalysis) {
    setSentences(prev =>
      prev.map(s => s.id === sentenceId ? { ...s, analysis_cache: analysis, is_analyzed: true } : s)
    )
  }

  useEffect(() => {
    const apiKey = settings.claudeKey || settings.openaiKey || settings.geminiKey || settings.deepseekKey
    if (!apiKey) return
    const unanalyzed = sentences.filter(s => !s.analysis_cache)
    if (unanalyzed.length === 0) return

    preAnalyzeActive.current = true
    setPreProgress({ done: 0, total: unanalyzed.length })

    async function run() {
      for (let i = 0; i < unanalyzed.length; i++) {
        if (!preAnalyzeActive.current) break
        try {
          const result = await analyzeSentence(settings, unanalyzed[i].content)
          if (!preAnalyzeActive.current) break
          await saveSentenceAnalysis(unanalyzed[i].id, result)
          handleAnalyzed(unanalyzed[i].id, result)
        } catch { /* ignore */ }
        setPreProgress({ done: i + 1, total: unanalyzed.length })
      }
      setPreProgress(null)
    }

    run()
    return () => { preAnalyzeActive.current = false }
  }, [sentences.length, settings.provider])

  // After switching to study mode with a jump target, scroll + highlight it
  useEffect(() => {
    if (mode === 'study' && jumpToId) {
      setTimeout(() => {
        sentenceRefs.current[jumpToId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightId(jumpToId)
        setTimeout(() => setHighlightId(null), 2000)
      }, 50)
      setJumpToId(null)
    }
  }, [mode, jumpToId])

  // Save mode whenever it changes (after initial load)
  useEffect(() => {
    if (!id || loading) return
    saveMode(id, mode)
    if (mode !== 'read' && lastSeenRef.current) {
      saveReadPosition(id, lastSeenRef.current)
    }
  }, [mode])

  // Track last visible sentence in 通読 using IntersectionObserver
  useEffect(() => {
    if (mode !== 'read' || sentences.length === 0) return
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const sid = (entry.target as HTMLElement).dataset.sid
          if (sid) lastSeenRef.current = sid
        }
      }
    }, { rootMargin: '-20% 0px -60% 0px' })
    const timer = setTimeout(() => {
      Object.values(sentenceRefs.current).forEach(el => el && observer.observe(el))
    }, 100)
    return () => { clearTimeout(timer); observer.disconnect() }
  }, [mode, sentences.length])

  // Save 通読 position on page hide
  useEffect(() => {
    if (!id) return
    const save = () => {
      if (mode === 'read' && lastSeenRef.current) {
        saveReadPosition(id, lastSeenRef.current)
      }
    }
    document.addEventListener('visibilitychange', save)
    return () => { save(); document.removeEventListener('visibilitychange', save) }
  }, [id, mode])

  // Auto-scroll to currently speaking sentence
  useEffect(() => {
    if (speakingId && mode === 'read') {
      sentenceRefs.current[speakingId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [speakingId, mode])

  useEffect(() => () => stop(), [])

  const startReading = useCallback((fromIndex: number) => {
    const items = sentences.map(s => ({ id: s.id, text: s.content }))
    speakSequence(items, fromIndex, setSpeakingId)
  }, [sentences, speakSequence])

  function handleReadModeClick(sentenceId: string) {
    const idx = sentences.findIndex(s => s.id === sentenceId)
    if (idx < 0) return
    if (speaking && speakingId === sentenceId) {
      stop()
      setSpeakingId(null)
    } else {
      startReading(idx)
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    // Require significant horizontal movement and clearly more horizontal than vertical
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0 && mode === 'read') {
        stop(); setSpeakingId(null)
        setMode('study')
        setSwipeBlocking(true)
        setTimeout(() => setSwipeBlocking(false), 250)
      } else if (dx > 0 && mode === 'study') {
        setMode('read')
        setSwipeBlocking(true)
        setTimeout(() => setSwipeBlocking(false), 250)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="px-4 py-8 text-center text-gray-500">
        <p>{error || t.articleNotFound}</p>
        <button onClick={() => navigate('/')} className="mt-4 text-red-700 underline text-sm">{t.back}</button>
      </div>
    )
  }

  // Progress ring dimensions
  const PR = { r: 13, sz: 34, cx: 17, cy: 17 }
  const prCirc = 2 * Math.PI * PR.r

  return (
    <div className="max-w-lg mx-auto">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-10">
        <div className="bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm border-b border-gray-100 dark:border-[#2a2a2a] px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-gray-400 dark:text-gray-500 shrink-0">
              <ArrowLeft size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">{article.title}</h1>
                {article.level && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${LEVEL_COLORS[article.level] || ''}`}>
                    {article.level}
                  </span>
                )}
              </div>
            </div>

            {/* Pre-analysis progress ring */}
            {preProgress && (() => {
              const { done, total } = preProgress
              const offset = prCirc * (1 - done / total)
              return (
                <div className="relative shrink-0">
                  {/* Outer glow pulse to signal activity */}
                  <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
                  <svg width={PR.sz} height={PR.sz} viewBox={`0 0 ${PR.sz} ${PR.sz}`} className="-rotate-90">
                    {/* Track */}
                    <circle cx={PR.cx} cy={PR.cy} r={PR.r} fill="none" strokeWidth="3"
                      className="stroke-gray-200 dark:stroke-gray-700" />
                    {/* Progress arc */}
                    <circle cx={PR.cx} cy={PR.cy} r={PR.r} fill="none" strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={prCirc}
                      strokeDashoffset={offset}
                      className="stroke-blue-500 dark:stroke-blue-400 transition-[stroke-dashoffset] duration-500" />
                    {/* Spinning activity arc — shows something is happening between advances */}
                    <circle cx={PR.cx} cy={PR.cy} r={PR.r} fill="none" strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`8 ${(prCirc - 8).toFixed(1)}`}
                      className="stroke-blue-300/60 dark:stroke-blue-500/60">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${PR.cx} ${PR.cy}`}
                        to={`360 ${PR.cx} ${PR.cy}`}
                        dur="1.2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 select-none leading-none">
                      {total - done}
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Play/stop — read mode only */}
            {mode === 'read' && (
              <button
                onClick={() => {
                  if (speaking) { stop(); setSpeakingId(null) }
                  else startReading(0)
                }}
                className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                  speaking
                    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
                    : 'text-gray-400 dark:text-gray-500 active:text-gray-700'
                }`}
              >
                {speaking ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
            )}
          </div>
        </div>

        {/* Expanded sentence banner — study mode only */}
        {mode === 'study' && expandedSentence && (
          <div className="bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm border-b border-gray-200 dark:border-[#333] px-4 py-2.5">
            <p className="font-jp text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-20 overflow-y-auto" lang="ja">
              {expandedSentence}
            </p>
          </div>
        )}
      </div>

      {/* ── Cover image ─────────────────────────────────────── */}
      {coverImage && (
        <img src={coverImage} alt="" className="w-full h-48 object-cover" />
      )}

      {/* ── Main content (swipe-aware) ───────────────────────── */}
      <div
        className="relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Transparent overlay that eats the tap event right after a swipe,
            preventing accidental word-saves when fingers lift */}
        {swipeBlocking && (
          <div className="absolute inset-0 z-50" />
        )}

        {sentences.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-16">{t.noSentences}</p>
        ) : mode === 'read' ? (
          /* ── 通読モード ── */
          <div className="px-5 py-8 pb-28">
            <div className="font-jp text-[17px] leading-[2.2]" lang="ja">
              {groupByParagraph(article.content, sentences).map((group, gi) => (
                <p key={gi} className="mb-[1em]">
                  {group.map(s => (
                    <button
                      key={s.id}
                      ref={el => { sentenceRefs.current[s.id] = el as HTMLButtonElement | null }}
                      data-sid={s.id}
                      onClick={() => handleReadModeClick(s.id)}
                      className={`inline text-left rounded transition-colors duration-150 active:bg-amber-100 dark:active:bg-amber-900/30
                        ${speakingId === s.id ? 'font-bold text-gray-900 dark:text-gray-100' : highlightId === s.id ? 'font-bold text-gray-900 dark:text-gray-100 bg-amber-100 dark:bg-amber-900/40 rounded' : readIds.has(s.id) ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}
                    >
                      {showFurigana && s.analysis_cache?.furigana
                        ? <Furigana text={s.analysis_cache.furigana} />
                        : s.content
                      }
                    </button>
                  ))}
                </p>
              ))}
            </div>
          </div>
        ) : (
          /* ── 精読モード ── */
          <div className="px-4 py-4 space-y-3 pb-28">
            {sentences.map(sentence => (
              <div
                key={sentence.id}
                ref={el => { sentenceRefs.current[sentence.id] = el }}
                className="rounded-2xl"
              >
                <SentenceItem
                  sentence={sentence}
                  articleId={article.id}
                  onAnalyzed={handleAnalyzed}
                  onExpand={content => setExpandedSentence(content)}
                  showFurigana={showFurigana}
                  isRead={readIds.has(sentence.id)}
                  onRead={() => {
                    setReadIds(prev => new Set(prev).add(sentence.id))
                    markSentenceRead(article.id, sentence.id, sentences.length)
                  }}
                  vocabIndex={vocabIndex}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom bar ──────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center pointer-events-none">
        <div className="w-full max-w-lg pointer-events-auto
          bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm
          border-t border-gray-100 dark:border-[#2a2a2a]
          px-5 py-2.5 flex items-center justify-between">

          {/* Furigana toggle */}
          <button
            onClick={() => setShowFurigana(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showFurigana
                ? 'bg-red-700 text-white border-red-700'
                : 'border-gray-200 dark:border-[#444] text-gray-500 dark:text-gray-400'
            }`}
          >
            {showFurigana ? t.hideFurigana : t.showFurigana}
          </button>

          {/* Mode indicator — two dots showing current mode, swipe to switch */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] transition-colors ${mode === 'read' ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-300 dark:text-gray-600'}`}>
                {t.readMode}
              </span>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${mode === 'read' ? 'bg-gray-700 dark:bg-gray-200 scale-125' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${mode === 'study' ? 'bg-gray-700 dark:bg-gray-200 scale-125' : 'bg-gray-300 dark:bg-gray-600'}`} />
              </div>
              <span className={`text-[10px] transition-colors ${mode === 'study' ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-300 dark:text-gray-600'}`}>
                {t.studyMode}
              </span>
            </div>
            <span className="text-[9px] text-gray-300 dark:text-gray-600">
              {mode === 'read' ? '← ' : ''}{settings.language === 'en' ? 'swipe' : '划动切换'}{mode === 'study' ? ' →' : ''}
            </span>
          </div>

          {/* Right spacer matching furigana button width */}
          <div className="w-[72px]" />
        </div>
      </div>
    </div>
  )
}
