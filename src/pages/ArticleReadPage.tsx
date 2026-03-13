import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getArticle, getSentences, saveSentenceAnalysis, getVocabIndex } from '../lib/db'
import { getProgress, markSentenceRead, saveReadPosition, saveMode } from '../lib/progress'
import type { Article, Sentence, SentenceAnalysis } from '../types'
import SentenceItem from '../components/SentenceItem'
import Furigana from '../components/Furigana'
import { analyzeSentence } from '../lib/ai'
import { useSettings } from '../hooks/useSettings'
import { splitIntoSentences } from '../lib/sentences'

const LEVEL_COLORS: Record<string, string> = {
  N5: 'bg-green-100 text-green-700',
  N4: 'bg-blue-100 text-blue-700',
  N3: 'bg-yellow-100 text-yellow-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
}

type Mode = 'read' | 'study'

function groupByParagraph(content: string, sentences: Sentence[]): Sentence[][] {
  const paragraphs = content.split('\n').filter(p => p.trim().length > 0)
  const groups: Sentence[][] = []
  let idx = 0
  for (const para of paragraphs) {
    const count = splitIntoSentences(para).length
    groups.push(sentences.slice(idx, idx + count))
    idx += count
  }
  // Leftover sentences (if any) go into the last group
  if (idx < sentences.length) groups.push(sentences.slice(idx))
  return groups.filter(g => g.length > 0)
}

export default function ArticleReadPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { settings } = useSettings()
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
    // When switching away from 通读, persist last seen sentence position
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
    // Observe after sentences render
    const t = setTimeout(() => {
      Object.values(sentenceRefs.current).forEach(el => el && observer.observe(el))
    }, 100)
    return () => { clearTimeout(t); observer.disconnect() }
  }, [mode, sentences.length])

  // Save 通読 position on page hide (tab switch / navigate away)
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

  function switchToStudy(sentenceId: string) {
    setMode('study')
    setJumpToId(sentenceId)
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
        <p>{error || '文章不存在'}</p>
        <button onClick={() => navigate('/')} className="mt-4 text-red-700 underline text-sm">返回</button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10">
        <div className="bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm border-b border-gray-100 dark:border-[#2a2a2a] px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-gray-400 dark:text-gray-500 shrink-0">
              <ArrowLeft size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-gray-900 dark:text-gray-100 truncate">{article.title}</h1>
                {article.level && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${LEVEL_COLORS[article.level] || ''}`}>
                    {article.level}
                  </span>
                )}
              </div>
              {preProgress
                ? <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" />
                    预分析中 {preProgress.done}/{preProgress.total}
                  </p>
                : <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {mode === 'read' ? '点击句子切换到精读' : '点击句子展开分析'}
                  </p>
              }
            </div>
            {/* Mode toggle */}
            <div className="flex shrink-0 bg-gray-100 dark:bg-[#2a2a2a] rounded-lg p-0.5 text-xs font-medium">
              <button
                onClick={() => setMode('read')}
                className={`px-2.5 py-1 rounded-md transition-colors ${mode === 'read' ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 dark:text-gray-500'}`}
              >通读</button>
              <button
                onClick={() => setMode('study')}
                className={`px-2.5 py-1 rounded-md transition-colors ${mode === 'study' ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 dark:text-gray-500'}`}
              >精读</button>
            </div>
            {/* Furigana toggle */}
            <button
              onClick={() => setShowFurigana(v => !v)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                showFurigana
                  ? 'bg-red-700 text-white border-red-700'
                  : 'border-gray-200 dark:border-[#444] text-gray-500 dark:text-gray-400'
              }`}
            >
              {showFurigana ? '隐藏假名' : '显示假名'}
            </button>
          </div>
        </div>

        {/* Expanded sentence banner — only in study mode */}
        {mode === 'study' && expandedSentence && (
          <div className="bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm border-b border-gray-200 dark:border-[#333] px-4 py-2.5">
            <p className="font-jp text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-20 overflow-y-auto" lang="ja">
              {expandedSentence}
            </p>
          </div>
        )}
      </div>

      {sentences.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-16">暂无句子数据</p>
      ) : mode === 'read' ? (
        /* ── 通读模式 ── */
        <div className="px-5 py-8 pb-24">
          <div className="font-jp text-[17px] leading-[2.2]" lang="ja">
            {groupByParagraph(article.content, sentences).map((group, gi) => (
              <span key={gi}>
                {gi > 0 && <br />}
                {group.map(s => (
                  <button
                    key={s.id}
                    ref={el => { sentenceRefs.current[s.id] = el as HTMLButtonElement | null }}
                    data-sid={s.id}
                    onClick={() => switchToStudy(s.id)}
                    className={`inline text-left rounded transition-colors duration-150 active:bg-amber-100 dark:active:bg-amber-900/30
                      ${readIds.has(s.id) ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}
                  >
                    {showFurigana && s.analysis_cache?.furigana
                      ? <Furigana text={s.analysis_cache.furigana} />
                      : s.content
                    }
                  </button>
                ))}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* ── 精读模式 ── */
        <div className="px-4 py-4 space-y-3 pb-24">
          {sentences.map(sentence => (
            <div
              key={sentence.id}
              ref={el => { sentenceRefs.current[sentence.id] = el }}
              className={`rounded-2xl transition-all duration-700 ${highlightId === sentence.id ? 'ring-2 ring-red-400 ring-offset-2' : ''}`}
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
  )
}
