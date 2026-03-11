import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getArticle, getSentences } from '../lib/db'
import type { Article, Sentence, SentenceAnalysis } from '../types'
import SentenceItem from '../components/SentenceItem'

const LEVEL_COLORS: Record<string, string> = {
  N5: 'bg-green-100 text-green-700',
  N4: 'bg-blue-100 text-blue-700',
  N3: 'bg-yellow-100 text-yellow-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
}

export default function ArticleReadPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const targetSentenceId = searchParams.get('sentence')
  const sentenceRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [article, setArticle] = useState<Article | null>(null)
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(targetSentenceId)

  useEffect(() => {
    if (id) load(id)
  }, [id])

  async function load(articleId: string) {
    try {
      const [art, sents] = await Promise.all([
        getArticle(articleId),
        getSentences(articleId),
      ])
      if (!art) { setError('文章不存在'); return }
      setArticle(art)
      setSentences(sents)
      // Scroll to target sentence after render
      if (targetSentenceId) {
        setTimeout(() => {
          const el = sentenceRefs.current[targetSentenceId]
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Clear highlight after 3s
            setTimeout(() => setHighlightId(null), 3000)
          }
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
      prev.map(s => s.id === sentenceId
        ? { ...s, analysis_cache: analysis, is_analyzed: true }
        : s
      )
    )
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
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-gray-900 truncate">{article.title}</h1>
              {article.level && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${LEVEL_COLORS[article.level] || ''}`}>
                  {article.level}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">点击句子展开分析</p>
          </div>
        </div>
      </div>

      {/* Sentences */}
      <div className="px-4 py-4 space-y-3 pb-24">
        {sentences.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">暂无句子数据</p>
        ) : (
          sentences.map(sentence => (
            <div
              key={sentence.id}
              ref={el => { sentenceRefs.current[sentence.id] = el }}
              className={`rounded-2xl transition-all duration-700 ${highlightId === sentence.id ? 'ring-2 ring-red-400 ring-offset-2' : ''}`}
            >
              <SentenceItem
                sentence={sentence}
                articleId={article.id}
                onAnalyzed={handleAnalyzed}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
