import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, Trash2, FileText, Loader2 } from 'lucide-react'
import { getArticles, deleteArticle } from '../lib/db'
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

export default function ArticlesPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const t = getT(settings.language)
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await getArticles()
      setArticles(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
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
                <Link
                  to={`/article/${article.id}`}
                  className="block bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-2xl p-4"
                >
                  {(() => {
                    const prog = getProgress(article.id)
                    const pct = prog.total > 0 ? Math.round(prog.readIds.length / prog.total * 100) : 0
                    return (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{article.title}</span>
                        {article.level && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${LEVEL_COLORS[article.level] || ''}`}>
                            {article.level}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-jp leading-relaxed line-clamp-2">
                        {article.content.slice(0, 80)}…
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-gray-300 dark:text-gray-600">{formatDate(article.created_at)}</p>
                        {prog.total > 0 && (
                          <div className="flex items-center gap-1.5 flex-1">
                            <div className="flex-1 h-1 bg-gray-100 dark:bg-[#333] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-400 dark:bg-green-600 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                              {t.sentenceCount(prog.readIds.length)}/{t.sentenceCount(prog.total)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => { e.preventDefault(); setDeleteId(article.id) }}
                        className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                      <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
                    </div>
                  </div>
                    )
                  })()}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
